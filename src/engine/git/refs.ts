import type { Out, Segment } from '../output';
import { headBranch, headId, headTree } from '../repo';
import type { LocalRepo } from '../types';

/**
 * Resolves HEAD, @, branch names, origin/<branch>, origin, abbreviated hashes,
 * and ~n / ^n suffixes. Returns a full commit id or null.
 */
export function resolveRef(L: LocalRepo, ref: string): string | null {
  const m = ref.match(/^(.*?)((?:[~^]\d*)*)$/);
  if (!m) return null;
  const base = m[1] ?? '';
  const suffix = m[2] ?? '';
  let id: string | null = null;
  if (base === 'HEAD' || base === '@') id = headId(L);
  else if (base in L.branches) id = L.branches[base]!;
  else if (base === 'origin' || base === 'origin/HEAD') id = L.remoteBranches[L.remoteHead] ?? null;
  else if (base.startsWith('origin/') && base.slice(7) in L.remoteBranches) id = L.remoteBranches[base.slice(7)]!;
  else if (/^[0-9a-f]{4,40}$/.test(base)) {
    const hits = Object.keys(L.commits).filter((k) => k.startsWith(base));
    if (hits.length === 1) id = hits[0]!;
  }
  if (!id) return null;
  const re = /([~^])(\d*)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(suffix))) {
    const k = mm[2] === '' ? 1 : parseInt(mm[2]!, 10);
    if (mm[1] === '^') {
      if (k === 0) continue;
      id = L.commits[id]?.parents[k - 1] ?? null;
    } else {
      for (let q = 0; q < k && id; q++) id = L.commits[id]?.parents[0] ?? null;
    }
    if (!id) return null;
  }
  return id;
}

/** The yellow "(HEAD -> main, origin/main, origin/HEAD)" part of `git log`. */
export function decorations(L: LocalRepo, id: string): Segment[] {
  const parts: Segment[][] = [];
  const hb = headBranch(L);
  if (L.head.kind === 'detached' && L.head.id === id) parts.push([['HEAD', 'c']]);
  if (hb && L.branches[hb] === id) parts.push([['HEAD -> ', 'c'], [hb, 'g']]);
  // git's order: remote-tracking refs, then local branches, each by name in reverse.
  for (const b of [...Object.keys(L.remoteBranches), 'HEAD'].sort().reverse()) {
    if ((b === 'HEAD' ? L.remoteBranches[L.remoteHead] : L.remoteBranches[b]) === id) parts.push([['origin/' + b, 'r']]);
  }
  for (const b of Object.keys(L.branches).sort().reverse()) if (b !== hb && L.branches[b] === id) parts.push([[b, 'g']]);
  if (!parts.length) return [];
  const out: Segment[] = [[' (', 'y']];
  parts.forEach((p, i) => {
    if (i) out.push([', ', 'y']);
    out.push(...p);
  });
  out.push([')', 'y']);
  return out;
}

export interface RevsAndPaths {
  flags: Record<string, true>;
  n: number;
  /** Resolved commit ids, in the order given. A range a..b adds both, and sets `range`. */
  refs: string[];
  range: boolean;
  paths: string[];
}

/** Parses `<flags> <revisions> [--] <paths>` the way log/show/diff take them. */
export function parseRevsAndPaths(L: LocalRepo, out: Out, args: string[], knownFlags: string[]): RevsAndPaths | null {
  const res: RevsAndPaths = { flags: {}, n: Infinity, refs: [], range: false, paths: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--') {
      res.paths.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('-')) {
      if (a === '-n' || a === '--max-count') {
        res.n = parseInt(args[++i] ?? '', 10);
        continue;
      }
      if (/^-\d+$/.test(a)) {
        res.n = parseInt(a.slice(1), 10);
        continue;
      }
      if (/^--max-count=\d+$/.test(a)) {
        res.n = parseInt(a.split('=')[1]!, 10);
        continue;
      }
      if (knownFlags.includes(a)) {
        res.flags[a] = true;
        continue;
      }
      out.print('fatal: unrecognized argument: ' + a, 'r');
      return null;
    }
    if (a.includes('..')) {
      const [x, y] = a.split('..');
      const rx = resolveRef(L, x || 'HEAD');
      const ry = resolveRef(L, y || 'HEAD');
      if (rx && ry) {
        res.refs.push(rx, ry);
        res.range = true;
        continue;
      }
    }
    const id = resolveRef(L, a);
    if (id) {
      res.refs.push(id);
      continue;
    }
    if (a in L.work || a in headTree(L) || a in L.index) {
      res.paths.push(a);
      continue;
    }
    out.print(
      "fatal: ambiguous argument '" + a + "': unknown revision or path not in the working tree.\n" +
        "Use '--' to separate paths from revisions, like this:\n" +
        "'git <command> [<revision>...] -- [<file>...]'",
      'r',
    );
    return null;
  }
  if (Number.isNaN(res.n)) res.n = Infinity;
  return res;
}
