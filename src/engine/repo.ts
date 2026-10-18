import { lines, treeDiff } from './diff';
import { sha } from './hash';
import type { Commit, LocalRepo, Person, RemoteRepo, Status, Tree, World } from './types';

export function makeCommit(fields: Omit<Commit, 'id'>): Commit {
  const id = sha(JSON.stringify(fields.tree) + '\0' + fields.message + '\0' + fields.author.name + '\0' + fields.time + '\0' + fields.parents.join(','));
  return { id, ...fields };
}

export const firstLine = (msg: string): string => msg.split('\n')[0] ?? '';

export function treeOf(commits: Record<string, Commit>, id: string | null | undefined): Tree {
  return id && commits[id] ? commits[id].tree : {};
}

/** The commit HEAD points at, or null in an empty repository. */
export function headId(L: LocalRepo): string | null {
  return L.head.kind === 'branch' ? (L.branches[L.head.name] ?? null) : L.head.id;
}

export function headBranch(L: LocalRepo): string | null {
  return L.head.kind === 'branch' ? L.head.name : null;
}

export const headTree = (L: LocalRepo): Tree => treeOf(L.commits, headId(L));

/** Moves HEAD's branch (or a detached HEAD) to `id`. */
export function setHead(L: LocalRepo, id: string): void {
  if (L.head.kind === 'branch') L.branches[L.head.name] = id;
  else L.head = { kind: 'detached', id };
}

export function ancestors(commits: Record<string, Commit>, id: string | null | undefined): Set<string> {
  const seen = new Set<string>();
  const stack = id ? [id] : [];
  while (stack.length) {
    const c = stack.pop()!;
    if (seen.has(c) || !commits[c]) continue;
    seen.add(c);
    stack.push(...commits[c].parents);
  }
  return seen;
}

/** Is `a` reachable from `b` (is `a` an ancestor of `b`, or the same commit)? */
export const isAncestor = (commits: Record<string, Commit>, a: string, b: string): boolean => ancestors(commits, b).has(a);

/** Commits reachable from `tip` but not from `base`, newest first (first-parent order). */
export function commitsSince(commits: Record<string, Commit>, tip: string | null, base: string | null): Commit[] {
  const stop = ancestors(commits, base);
  const out: Commit[] = [];
  let id = tip;
  while (id && !stop.has(id) && commits[id]) {
    out.push(commits[id]);
    id = commits[id].parents[0] ?? null;
  }
  return out;
}

export function aheadBehind(L: LocalRepo, branch: string): { ahead: number; behind: number; upstream: string | null } {
  const up = L.upstream[branch] ?? null;
  const local = L.branches[branch];
  const remote = up ? L.remoteBranches[up] : undefined;
  if (!up || !local || !remote) return { ahead: 0, behind: 0, upstream: up };
  const a = ancestors(L.commits, local);
  const b = ancestors(L.commits, remote);
  let ahead = 0;
  let behind = 0;
  for (const x of a) if (!b.has(x)) ahead++;
  for (const x of b) if (!a.has(x)) behind++;
  return { ahead, behind, upstream: up };
}

/** What `git clone` produces. */
export function cloneRepo(remote: RemoteRepo, dir: string): LocalRepo {
  const branch = remote.defaultBranch;
  const tip = remote.branches[branch]!;
  return {
    dir,
    url: remote.url,
    commits: { ...remote.commits },
    head: { kind: 'branch', name: branch },
    branches: { [branch]: tip },
    remoteBranches: { ...remote.branches },
    remoteHead: branch,
    upstream: { [branch]: branch },
    index: { ...remote.commits[tip]!.tree },
    work: { ...remote.commits[tip]!.tree },
  };
}

/** One commit in a scripted history. `null` deletes a file. */
export interface HistoryStep {
  author: Person;
  /** ISO date with offset, e.g. "2026-10-04T09:10:00+03:00". */
  iso: string;
  message: string;
  changes: Record<string, string | null>;
}

/** Builds a remote repository from a list of steps (used by level fixtures). */
export function buildRemote(url: string, steps: HistoryStep[], opts: { branch?: string; protectedBranches?: string[] } = {}): RemoteRepo {
  const branch = opts.branch ?? 'main';
  const commits: Record<string, Commit> = {};
  let tree: Tree = {};
  let parent: string | null = null;
  for (const s of steps) {
    tree = { ...tree };
    for (const [p, content] of Object.entries(s.changes)) {
      if (content === null) delete tree[p];
      else tree[p] = content;
    }
    const c = makeCommit({ tree, message: s.message, author: s.author, time: Date.parse(s.iso), parents: parent ? [parent] : [] });
    commits[c.id] = c;
    parent = c.id;
  }
  return {
    url,
    commits,
    branches: parent ? { [branch]: parent } : {},
    defaultBranch: branch,
    protectedBranches: opts.protectedBranches ?? [],
  };
}

/** Adds scripted commits on top of `from` as `branch` of a built remote (used by level fixtures). */
export function extendBranch(remote: RemoteRepo, branch: string, from: string, steps: HistoryStep[]): void {
  let parent = remote.branches[from] ?? from;
  let tree = remote.commits[parent]!.tree;
  for (const s of steps) {
    tree = { ...tree };
    for (const [p, content] of Object.entries(s.changes)) {
      if (content === null) delete tree[p];
      else tree[p] = content;
    }
    const c = makeCommit({ tree, message: s.message, author: s.author, time: Date.parse(s.iso), parents: [parent] });
    remote.commits[c.id] = c;
    parent = c.id;
  }
  remote.branches[branch] = parent;
}

/** A clone on `branch` instead of the default branch, tracking it, as if the player had switched to it. */
export function cloneOnBranch(remote: RemoteRepo, dir: string, branch: string): LocalRepo {
  const L = cloneRepo(remote, dir);
  const tip = remote.branches[branch]!;
  L.branches[branch] = tip;
  L.upstream[branch] = branch;
  L.head = { kind: 'branch', name: branch };
  L.previous = remote.defaultBranch;
  L.index = { ...remote.commits[tip]!.tree };
  L.work = { ...remote.commits[tip]!.tree };
  return L;
}

/* ---------------- .gitignore ---------------- */

export function ignoreRules(text: string | undefined): string[] {
  return lines(text ?? '')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

/** Supports exact names, a leading or trailing slash, and `*` wildcards. Enough for the game. */
export function isIgnored(path: string, gitignore: string | undefined): boolean {
  return ignoreRules(gitignore).some((rule) => {
    const r = rule.replace(/^\//, '').replace(/\/$/, '');
    if (r.includes('*')) {
      const re = new RegExp(
        '^' +
          r
            .split('*')
            .map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$',
      );
      return re.test(path);
    }
    return r === path;
  });
}

/* ---------------- status ---------------- */

export function computeStatus(L: LocalRepo): Status {
  const head = headTree(L);
  const staged = treeDiff(head, L.index).map((path) => ({
    path,
    kind: !(path in head) ? ('new file' as const) : !(path in L.index) ? ('deleted' as const) : ('modified' as const),
  }));
  const unstaged = Object.keys(L.index)
    .filter((p) => L.work[p] !== L.index[p])
    .sort()
    .map((path) => ({ path, kind: !(path in L.work) ? ('deleted' as const) : ('modified' as const) }));
  const untracked = Object.keys(L.work)
    .filter((p) => !(p in L.index) && !isIgnored(p, L.work['.gitignore']))
    .sort();
  return { staged, unstaged, untracked };
}

export const isClean = (s: Status): boolean => !s.staged.length && !s.unstaged.length && !s.untracked.length;

/* ---------------- world ---------------- */

export const inRepo = (w: World): boolean => !!w.local && w.cwd === '~/' + w.local.dir;
