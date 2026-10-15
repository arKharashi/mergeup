import type { Ctx } from '../context';
import { treeDiff } from '../diff';
import { short } from '../hash';
import type { Segment } from '../output';
import { ancestors, firstLine, headId, headTree } from '../repo';
import type { Commit, LocalRepo, Tree } from '../types';
import { gitDate, printStat, printTreeDiff } from './format';
import { decorations, parseRevsAndPaths, resolveRef } from './refs';

const parentTree = (L: LocalRepo, c: Commit): Tree => (c.parents[0] ? L.commits[c.parents[0]]!.tree : {});

function printHeader(ctx: Ctx, c: Commit, prefix = ''): void {
  const L = ctx.world.local!;
  const { out } = ctx;
  const first: Segment[] = [[prefix ? '* ' : '', 'y'], ['commit ' + c.id, 'y'], ...decorations(L, c.id)];
  out.line(first);
  const pre = prefix ? '| ' : '';
  if (c.parents.length > 1) out.print(pre + 'Merge: ' + c.parents.map(short).join(' '));
  out.print(pre + 'Author: ' + c.author.name + ' <' + c.author.email + '>');
  out.print(pre + 'Date:   ' + gitDate(c.time));
  out.print(pre);
  for (const l of c.message.split('\n')) out.print(pre + '    ' + l);
  out.print(pre);
}

/** git log [--oneline] [--stat] [-p] [--graph] [-n N] [--reverse] [<rev> | a..b] [-- <paths>] */
export function gitLog(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const parsed = parseRevsAndPaths(L, out, args, [
    '--oneline', '--stat', '-p', '--patch', '--graph', '--all', '--decorate', '--name-only', '--reverse', '--no-decorate',
  ]);
  if (!parsed) return false;
  const { flags, refs, range, paths, n } = parsed;

  const start = range ? refs[1]! : (refs[refs.length - 1] ?? headId(L));
  if (!start) {
    out.print("fatal: your current branch does not have any commits yet", 'r');
    return false;
  }
  const exclude = range ? ancestors(L.commits, refs[0]!) : new Set<string>();

  // Walk first parents, newest first. Merges show up once the Junior rank adds them.
  let list: Commit[] = [];
  let id: string | null = start;
  while (id && list.length < n && L.commits[id]) {
    if (exclude.has(id)) break;
    const c: Commit = L.commits[id]!;
    if (!paths.length || treeDiff(parentTree(L, c), c.tree, paths).length) list.push(c);
    id = c.parents[0] ?? null;
  }
  if (flags['--reverse']) list = list.reverse();

  const graph = !!flags['--graph'];
  for (const c of list) {
    if (flags['--oneline']) {
      out.line([[graph ? '* ' : '', 'y'], [short(c.id), 'y'], ...decorations(L, c.id), [' ' + firstLine(c.message)]]);
    } else {
      printHeader(ctx, c, graph ? '*' : '');
    }
    if (flags['--stat']) {
      printStat(out, parentTree(L, c), c.tree, paths);
      out.print('');
    }
    if (flags['--name-only']) {
      for (const p of treeDiff(parentTree(L, c), c.tree, paths)) out.print(p);
      out.print('');
    }
    if (flags['-p'] || flags['--patch']) {
      printTreeDiff(out, parentTree(L, c), c.tree, paths);
      out.print('');
    }
  }
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
    else printHeader(ctx, c);
    if (parsed.flags['--stat']) printStat(out, parentTree(L, c), c.tree, parsed.paths);
    else if (parsed.flags['--name-only']) for (const p of treeDiff(parentTree(L, c), c.tree, parsed.paths)) out.print(p);
    else printTreeDiff(out, parentTree(L, c), c.tree, parsed.paths);
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
