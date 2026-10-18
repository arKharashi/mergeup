import type { Ctx } from '../context';
import { treeDiff } from '../diff';
import { short } from '../hash';
import { ancestors, firstLine, headId, headTree } from '../repo';
import type { Commit, LocalRepo, Tree } from '../types';
import { gitDate, printStat, printTreeDiff } from './format';
import { Graph, prefixed, walkCommits } from './graph';
import { decorations, parseRevsAndPaths, resolveRef } from './refs';

const parentTree = (L: LocalRepo, c: Commit): Tree => (c.parents[0] ? L.commits[c.parents[0]]!.tree : {});

/** commit, Merge, Author, Date and the message. `first` starts the commit line, `pre()` every line after it. */
function printHeader(ctx: Ctx, c: Commit, first = '', pre: () => string = () => ''): void {
  const L = ctx.world.local!;
  const { out } = ctx;
  out.line([[first], ['commit ' + c.id, 'y'], ...decorations(L, c.id)]);
  if (c.parents.length > 1) out.print(pre() + 'Merge: ' + c.parents.map(short).join(' '));
  out.print(pre() + 'Author: ' + c.author.name + ' <' + c.author.email + '>');
  out.print(pre() + 'Date:   ' + gitDate(c.time));
  out.print(pre());
  for (const l of c.message.split('\n')) out.print(pre() + '    ' + l);
}

/** git log [--oneline] [--stat] [-p] [--graph] [--first-parent] [-n N] [--reverse] [<rev> | a..b] [-- <paths>] */
export function gitLog(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const parsed = parseRevsAndPaths(L, out, args, [
    '--oneline', '--stat', '-p', '--patch', '--graph', '--all', '--decorate', '--name-only', '--reverse', '--no-decorate', '--first-parent',
  ]);
  if (!parsed) return false;
  const { flags, refs, range, paths, n } = parsed;
  if (flags['--graph'] && flags['--reverse']) {
    out.print("fatal: options '--graph' and '--reverse' cannot be used together", 'r');
    return false;
  }

  const start = range ? refs[1]! : (refs[refs.length - 1] ?? headId(L));
  if (!start) {
    out.print("fatal: your current branch does not have any commits yet", 'r');
    return false;
  }
  const firstParent = !!flags['--first-parent'];
  const starts = flags['--all'] ? [start, ...Object.values(L.branches), ...Object.values(L.remoteBranches)] : [start];
  const exclude = range ? ancestors(L.commits, refs[0]!) : new Set<string>();
  let list = walkCommits(L.commits, starts, exclude, firstParent)
    .filter((c) => !paths.length || treeDiff(parentTree(L, c), c.tree, paths).length)
    .slice(0, n);
  if (flags['--reverse']) list = list.reverse();

  const oneline = !!flags['--oneline'];
  const shown = new Set(list.map((c) => c.id));
  const graph = flags['--graph'] ? new Graph() : null;
  const pre = () => (graph ? graph.next() : '');
  const body = graph ? prefixed(out, pre) : out;
  list.forEach((c, i) => {
    if (graph) for (const l of graph.flush()) out.print(l);
    if (i && !oneline) out.print(graph ? graph.gap() : '');
    const parents = (firstParent ? c.parents.slice(0, 1) : c.parents).filter((p) => shown.has(p));
    const first = graph ? graph.row(c, parents) : '';
    if (oneline) {
      out.line([[first], [short(c.id), 'y'], ...decorations(L, c.id), [' ' + firstLine(c.message)]]);
      if (graph) for (const l of graph.flush()) out.print(l);
    } else {
      printHeader(ctx, c, first, pre);
    }
    // Like git, a merge shows no changes of its own in the log.
    if (c.parents.length > 1) return;
    const blank = () => {
      if (!oneline) body.print('');
    };
    if (flags['--stat']) {
      blank();
      printStat(body, parentTree(L, c), c.tree, paths);
    }
    if (flags['--name-only']) {
      blank();
      for (const p of treeDiff(parentTree(L, c), c.tree, paths)) body.print(p);
    }
    if (flags['-p'] || flags['--patch']) {
      blank();
      printTreeDiff(body, parentTree(L, c), c.tree, paths);
    }
  });
  if (graph) for (const l of graph.flush()) out.print(l);
  return true;
}

/** git show [<rev>] [--stat | --name-only | --oneline] [-- <paths>]  and  git show <rev>:<path> */
export function gitShow(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const objPath = args.find((a) => !a.startsWith('-') && a.includes(':'));
  if (objPath) {
    const k = objPath.indexOf(':');
    const r = objPath.slice(0, k) || 'HEAD';
    const p = objPath.slice(k + 1);
    const id = resolveRef(L, r);
    if (!id) {
      out.print("fatal: invalid object name '" + r + "'.", 'r');
      return false;
    }
    const content = L.commits[id]!.tree[p];
    if (content === undefined) {
      out.print("fatal: path '" + p + "' does not exist in '" + r + "'", 'r');
      return false;
    }
    out.print(content.replace(/\n$/, ''));
    return true;
  }
  const parsed = parseRevsAndPaths(L, out, args, ['--stat', '--name-only', '--oneline']);
  if (!parsed) return false;
  const head = headId(L);
  const ids = parsed.refs.length ? parsed.refs : head ? [head] : [];
  for (const id of ids) {
    const c = L.commits[id]!;
    if (parsed.flags['--oneline']) out.line([[short(c.id), 'y'], ...decorations(L, c.id), [' ' + firstLine(c.message)]]);
    else {
      printHeader(ctx, c);
      out.print('');
    }
    if (parsed.flags['--stat']) printStat(out, parentTree(L, c), c.tree, parsed.paths);
    else if (parsed.flags['--name-only']) for (const p of treeDiff(parentTree(L, c), c.tree, parsed.paths)) out.print(p);
    // A clean merge has no changes of its own to show (git's combined diff is empty).
    else if (c.parents.length < 2) printTreeDiff(out, parentTree(L, c), c.tree, parsed.paths);
  }
  return true;
}

/** The working tree as git sees it: only tracked files. */
function trackedWork(L: LocalRepo): Tree {
  const t: Tree = {};
  for (const p of Object.keys(L.index)) if (p in L.work) t[p] = L.work[p]!;
  return t;
}

/** git diff [--staged] [<rev> [<rev>] | a..b] [--stat | --name-only] [-- <paths>] */
export function gitDiff(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const parsed = parseRevsAndPaths(L, out, args, ['--staged', '--cached', '--stat', '--name-only']);
  if (!parsed) return false;
  const { flags, refs, paths } = parsed;
  const staged = flags['--staged'] || flags['--cached'];
  let a: Tree;
  let b: Tree;
  if (staged) {
    a = refs[0] ? L.commits[refs[0]]!.tree : headTree(L);
    b = L.index;
  } else if (refs.length >= 2) {
    a = L.commits[refs[0]!]!.tree;
    b = L.commits[refs[1]!]!.tree;
  } else if (refs.length === 1) {
    a = L.commits[refs[0]!]!.tree;
    b = trackedWork(L);
  } else {
    a = L.index;
    b = trackedWork(L);
  }
  if (flags['--stat']) printStat(out, a, b, paths);
  else if (flags['--name-only']) for (const p of treeDiff(a, b, paths)) out.print(p);
  else printTreeDiff(out, a, b, paths);
  return true;
}
