import type { Ctx } from '../context';
import { computeStatus, headId, headTree, isIgnored, setHead, firstLine } from '../repo';
import { short } from '../hash';
import { resolveRef } from './refs';
import type { LocalRepo } from '../types';
import type { Out } from '../output';

/** git add <paths> | . | -A | -u | -f */
export function gitAdd(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const force = args.includes('-f') || args.includes('--force');
  const updateOnly = args.includes('-u') || args.includes('--update');
  const paths = args.filter((a) => !a.startsWith('-') || a === '-A');
  if (!paths.length && !updateOnly) {
    out.print("Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?", 'y');
    return false;
  }
  const ignoredHit: string[] = [];
  const addOne = (p: string, explicit: boolean) => {
    if (p in L.work) {
      if (!(p in L.index)) {
        if (updateOnly) return;
        if (!force && isIgnored(p, L.work['.gitignore'])) {
          if (explicit) ignoredHit.push(p);
          return;
        }
      }
      L.index[p] = L.work[p]!;
    } else if (p in L.index) {
      delete L.index[p];
    }
  };
  const all = () => {
    for (const f of Object.keys(L.work)) addOne(f, false);
    for (const f of Object.keys(L.index)) if (!(f in L.work)) delete L.index[f];
  };
  if (updateOnly && !paths.length) all();
  for (const p of paths) {
    if (p === '.' || p === '-A' || p === '--all' || p === '*') {
      all();
    } else if (p in L.work || p in L.index) {
      addOne(p, true);
    } else {
      out.print("fatal: pathspec '" + p + "' did not match any files", 'r');
      return false;
    }
  }
  if (ignoredHit.length) {
    out.print(
      'The following paths are ignored by one of your .gitignore files:\n' + ignoredHit.join('\n') +
        '\nhint: Use -f if you really want to add them.\nhint: Turn this message off by running\n' +
        'hint: "git config advice.addIgnoredFile false"',
      'y',
    );
    return false;
  }
  return true;
}

/** git restore [--staged] <paths> */
export function gitRestore(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const staged = args.includes('--staged') || args.includes('-S');
  const worktree = args.includes('--worktree') || args.includes('-W') || !staged;
  const paths = args.filter((a) => !a.startsWith('-'));
  if (!paths.length) {
    out.print('fatal: you must specify path(s) to restore', 'r');
    return false;
  }
  const head = headTree(L);
  const expand = (p: string) => (p === '.' ? [...new Set([...Object.keys(L.index), ...Object.keys(head)])] : [p]);
  for (const p0 of paths) {
    for (const p of expand(p0)) {
      if (!(p in L.index) && !(p in head)) {
        out.print("error: pathspec '" + p + "' did not match any file(s) known to git", 'r');
        return false;
      }
      if (staged) {
        if (p in head) L.index[p] = head[p]!;
        else delete L.index[p];
      }
      if (worktree) {
        if (p in L.index) L.work[p] = L.index[p]!;
        else if (!staged) {
          out.print("error: pathspec '" + p + "' did not match any file(s) known to git", 'r');
          return false;
        }
      }
    }
  }
  return true;
}

/** git rm [--cached] <paths> */
export function gitRm(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const cached = args.includes('--cached');
  const paths = args.filter((a) => !a.startsWith('-'));
  if (!paths.length) {
    out.print('usage: git rm [<options>] [--] <file>...', 'r');
    return false;
  }
  for (const p of paths) {
    if (!(p in L.index)) {
      out.print("fatal: pathspec '" + p + "' did not match any files", 'r');
      return false;
    }
  }
  for (const p of paths) {
    delete L.index[p];
    if (!cached) delete L.work[p];
    out.print("rm '" + p + "'");
  }
  return true;
}

function printUnstagedAfterReset(out: Out, L: LocalRepo): void {
  const st = computeStatus(L);
  if (!st.unstaged.length) return;
  out.print('Unstaged changes after reset:');
  for (const x of st.unstaged) out.print((x.kind === 'deleted' ? 'D' : 'M') + '\t' + x.path);
}

/** git reset [--soft | --mixed | --hard] [<commit>] [-- <paths>] */
export function gitReset(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  let mode: 'soft' | 'mixed' | 'hard' = 'mixed';
  const rest: string[] = [];
  for (const a of args) {
    if (a === '--soft') mode = 'soft';
    else if (a === '--hard') mode = 'hard';
    else if (a === '--mixed') mode = 'mixed';
    else if (a === '-q' || a === '--quiet') continue;
    else rest.push(a);
  }
  let refArg: string | null = null;
  let pathArgs: string[] = [];
  const dash = rest.indexOf('--');
  if (dash >= 0) {
    refArg = rest.slice(0, dash)[0] ?? null;
    pathArgs = rest.slice(dash + 1);
  } else {
    for (const a of rest) {
      if (!refArg && !pathArgs.length && resolveRef(L, a) && !(a in L.work)) refArg = a;
      else pathArgs.push(a);
    }
  }
  if (refArg && !resolveRef(L, refArg)) {
    out.print("fatal: ambiguous argument '" + refArg + "': unknown revision or path not in the working tree.", 'r');
    return false;
  }

  // Path form: put files from <commit> (default HEAD) back into the index.
  if (pathArgs.length) {
    if (mode !== 'mixed') {
      out.print('fatal: Cannot do ' + mode + ' reset with paths.', 'r');
      return false;
    }
    const base = refArg ? L.commits[resolveRef(L, refArg)!]!.tree : headTree(L);
    for (const p of pathArgs) {
      if (!(p in L.index) && !(p in base)) {
        out.print("error: pathspec '" + p + "' did not match any file(s) known to git", 'r');
        return false;
      }
      if (p in base) L.index[p] = base[p]!;
      else delete L.index[p];
    }
    printUnstagedAfterReset(out, L);
    return true;
  }

  const target = refArg ? resolveRef(L, refArg)! : headId(L);
  if (!target) {
    out.print('fatal: Failed to resolve HEAD as a valid ref.', 'r');
    return false;
  }
  const trackedBefore = new Set([...Object.keys(L.index), ...Object.keys(headTree(L))]);
  setHead(L, target);
  const tree = L.commits[target]!.tree;
  if (mode !== 'soft') L.index = { ...tree };
  if (mode === 'hard') {
    for (const p of trackedBefore) if (!(p in tree)) delete L.work[p];
    for (const [p, content] of Object.entries(tree)) L.work[p] = content;
    out.print('HEAD is now at ' + short(target) + ' ' + firstLine(L.commits[target]!.message));
  } else if (mode === 'mixed') {
    printUnstagedAfterReset(out, L);
  }
  return true;
}
