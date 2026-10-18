import type { Ctx } from '../context';
import { treeDiff } from '../diff';
import { short } from '../hash';
import type { Out } from '../output';
import { aheadBehind, firstLine, headBranch, headId, headTree, isAncestor, isIgnored } from '../repo';
import type { LocalRepo, Tree } from '../types';
import { resolveRef } from './refs';
import { gitRestore } from './stage';
import { trackingInfo } from './status';

/** `git check-ref-format --branch`, for the names a player can type. */
export function isValidBranchName(name: string): boolean {
  if (!name || name === 'HEAD' || /^[-/]|[/.]$/.test(name)) return false;
  if (/\.\.|@\{|\/\/|[\x00-\x20~^:?*[\\\x7f]/.test(name)) return false;
  return name.split('/').every((part) => !part.startsWith('.') && !part.endsWith('.lock'));
}

function invalidName(out: Out, name: string): false {
  out.print("fatal: '" + name + "' is not a valid branch name", 'r');
  out.print('hint: See `man git check-ref-format`\nhint: Disable this message with "git config set advice.refSyntax false"', 'y');
  return false;
}

function alreadyExists(out: Out, name: string): false {
  out.print("fatal: a branch named '" + name + "' already exists", 'r');
  return false;
}

/** Real git options the simulator doesn't have, such as `git switch -C`. */
function notBuilt(ctx: Ctx, command: string, flag: string): false {
  ctx.out.tip({
    ar: 'الخيار `' + flag + '` في `git ' + command + '` لسا ما انبنى في المحاكي.',
    en: 'The `' + flag + '` option of `git ' + command + '` isn’t built into the simulator yet.',
  });
  return false;
}

function lockedTip(ctx: Ctx, feature: 'branch create' | 'switch'): boolean {
  const rank = ctx.lockedUntil(feature);
  if (!rank) return false;
  ctx.out.tip(
    feature === 'branch create'
      ? {
          ar: 'إنشاء الفروع ينفتح لك في رتبة ' + rank + '. في رتبة Intern تشتغل على `main` بس.',
          en: 'Creating branches unlocks at the ' + rank + ' rank. As an Intern you work on `main` only.',
        }
      : {
          ar: 'التنقل بين الفروع ينفتح لك في رتبة ' + rank + '. لو تبي ترجع ملف لآخر نسخة استخدم `git restore <file>`.',
          en: 'Switching branches unlocks at the ' + rank + ' rank. To bring a file back to its last committed version, use `git restore <file>`.',
        },
  );
  return true;
}

const remoteName = (L: LocalRepo, ref: string): string | null =>
  ref.startsWith('origin/') && ref !== 'origin/HEAD' && ref.slice(7) in L.remoteBranches ? ref.slice(7) : null;

/** Where a new branch starts. Starting from origin/<b> tracks it, like git's branch.autoSetupMerge. */
interface Start {
  id: string;
  track?: string;
}

function startPoint(L: LocalRepo, ref: string | undefined): Start | null {
  const id = resolveRef(L, ref ?? 'HEAD');
  if (!id) return null;
  const track = ref === undefined ? null : remoteName(L, ref);
  return track ? { id, track } : { id };
}

/* ---------------- moving HEAD ---------------- */

/**
 * Updates the index and working tree from HEAD's tree to `to`, keeping uncommitted changes
 * to files the two trees agree on. Refuses, like git, when a change would be overwritten.
 */
function checkoutTree(out: Out, L: LocalRepo, to: Tree): boolean {
  const from = headTree(L);
  const changed = treeDiff(from, to);
  const local: string[] = [];
  const untracked: string[] = [];
  const keep = new Set<string>();
  for (const p of changed) {
    if (p in from || p in L.index) {
      const clean = L.index[p] === from[p] && (L.work[p] === L.index[p] || !(p in L.work));
      if (clean) continue;
      if (L.index[p] === to[p]) keep.add(p);
      else local.push(p);
    } else if (p in L.work && !isIgnored(p, L.work['.gitignore'])) {
      untracked.push(p);
    }
  }
  if (local.length || untracked.length) {
    if (local.length) {
      out.print(
        'error: Your local changes to the following files would be overwritten by checkout:\n\t' + local.join('\n\t') +
          '\nPlease commit your changes or stash them before you switch branches.',
        'r',
      );
    }
    if (untracked.length) {
      out.print(
        'error: The following untracked working tree files would be overwritten by checkout:\n\t' + untracked.join('\n\t') +
          '\nPlease move or remove them before you switch branches.',
        'r',
      );
    }
    out.print('Aborting', 'r');
    return false;
  }
  for (const p of changed) {
    if (keep.has(p)) continue;
    if (p in to) {
      L.index[p] = to[p]!;
      L.work[p] = to[p]!;
    } else {
      delete L.index[p];
      delete L.work[p];
    }
  }
  return true;
}

/** The uncommitted changes that came along, as `git switch` lists them: "M\tREADME.md". */
function printLocalChanges(out: Out, L: LocalRepo): void {
  const head = headTree(L);
  for (const p of [...new Set([...Object.keys(head), ...Object.keys(L.index)])].sort()) {
    const code = !(p in head) ? 'A' : !(p in L.index) || !(p in L.work) ? 'D' : L.work[p] !== head[p] ? 'M' : '';
    if (code) out.print(code + '\t' + p);
  }
}

/**
 * Puts HEAD on `name`, creating the branch first when `create` is given.
 * `listChanges` is false for `switch -c <name>` with no start point, which git does without touching the tree.
 */
function switchTo(ctx: Ctx, name: string, create: Start | null, listChanges = true): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const id = create ? create.id : L.branches[name]!;
  if (!checkoutTree(out, L, L.commits[id]!.tree)) return false;
  const old = headBranch(L);
  if (create) {
    L.branches[name] = id;
    if (create.track) L.upstream[name] = create.track;
  }
  L.head = { kind: 'branch', name };
  if (old) L.previous = old;
  if (listChanges) printLocalChanges(out, L);
  if (create?.track) out.print("branch '" + name + "' set up to track 'origin/" + create.track + "'.");
  if (create) out.print("Switched to a new branch '" + name + "'");
  else out.print((old === name ? "Already on '" : "Switched to branch '") + name + "'");
  const info = create ? null : trackingInfo(L, name);
  if (info) out.print(info);
  return true;
}

/** `switch -c` and `checkout -b`. */
function createAndSwitch(ctx: Ctx, name: string, start: string | undefined, badStart: string): boolean {
  const L = ctx.world.local!;
  if (!isValidBranchName(name)) return invalidName(ctx.out, name);
  if (name in L.branches) return alreadyExists(ctx.out, name);
  const at = startPoint(L, start);
  if (!at) {
    ctx.out.print(badStart, 'r');
    return false;
  }
  return switchTo(ctx, name, at, start !== undefined);
}

/** `git switch feature/x` when only origin/feature/x exists: git makes the local branch and tracks it. */
const guessFromRemote = (ctx: Ctx, name: string): boolean => switchTo(ctx, name, { id: ctx.world.local!.remoteBranches[name]!, track: name });

function detachTip(ctx: Ctx): false {
  ctx.out.tip({
    ar: 'الوقوف على commit بدون فرع (detached HEAD) لسا ما انبنى في المحاكي. تشوف نسخة قديمة من ملف بـ `git show <commit>:<file>`.',
    en: 'Standing on a commit without a branch (detached HEAD) isn’t built into the simulator yet. See an old version of a file with `git show <commit>:<file>`.',
  });
  return false;
}

/* ---------------- git switch ---------------- */

/** git switch <branch> | -c <new> [<start>] | - */
export function gitSwitch(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  let create: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '-c' || a === '--create') {
      create = args[++i];
      if (create === undefined) {
        out.print(a === '-c' ? "error: switch `c' requires a value" : "error: option `create' requires a value", 'r');
        return false;
      }
    } else if (a.startsWith('--create=')) create = a.slice(9);
    else if (a === '-d' || a === '--detach') return detachTip(ctx);
    else if (a.startsWith('-') && a !== '-') return notBuilt(ctx, 'switch', a);
    else rest.push(a);
  }
  if (create !== undefined) return createAndSwitch(ctx, create, rest[0], 'fatal: invalid reference: ' + rest[0]);

  const target = rest[0];
  if (target === undefined) {
    out.print('fatal: missing branch or commit argument', 'r');
    return false;
  }
  if (target === '-') {
    if (L.previous && L.previous in L.branches) return switchTo(ctx, L.previous, null);
    out.print('fatal: invalid reference: @{-1}', 'r');
    return false;
  }
  if (target in L.branches) return switchTo(ctx, target, null);
  if (target in L.remoteBranches) return guessFromRemote(ctx, target);
  const remote = remoteName(L, target);
  if (remote || resolveRef(L, target)) {
    out.print('fatal: a branch is expected, got ' + (remote ? 'remote branch' : 'commit') + " '" + target + "'", 'r');
    out.print('hint: If you want to detach HEAD at the commit, try again with the --detach option.', 'y');
    return false;
  }
  out.print('fatal: invalid reference: ' + target, 'r');
  return false;
}

/* ---------------- git checkout ---------------- */

/** git checkout <branch> | -b <new> [<start>] | - | <file>... | -- <file>... */
export function gitCheckout(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  if (args[0] === '--') return gitRestore(ctx, args.slice(1));
  let create: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '-b') {
      create = args[++i];
      if (create === undefined) {
        out.print("error: switch `b' requires a value", 'r');
        return false;
      }
    } else if (a === '--detach') return detachTip(ctx);
    else if (a.startsWith('-') && a !== '-') return notBuilt(ctx, 'checkout', a);
    else rest.push(a);
  }
  if (create !== undefined) {
    if (lockedTip(ctx, 'switch')) return false;
    const bad = "fatal: '" + rest[0] + "' is not a commit and a branch '" + create + "' cannot be created from it";
    return createAndSwitch(ctx, create, rest[0], bad);
  }

  const target = rest[0];
  if (target === undefined) {
    const b = headBranch(L);
    const info = b ? trackingInfo(L, b) : null;
    if (info) out.print(info);
    return true;
  }
  const head = headTree(L);
  const isPath = (p: string) => p === '.' || p in L.index || p in head;
  const isBranch = target in L.branches || (target in L.remoteBranches && rest.length === 1);
  if (!isBranch && rest.every(isPath)) return checkoutPaths(ctx, rest);
  if (lockedTip(ctx, 'switch')) return false;
  if (target === '-' && L.previous && L.previous in L.branches) return switchTo(ctx, L.previous, null);
  if (target in L.branches) return switchTo(ctx, target, null);
  if (isBranch) return guessFromRemote(ctx, target);
  if (target !== '-' && resolveRef(L, target)) return detachTip(ctx);
  out.print("error: pathspec '" + (rest.find((p) => !isPath(p)) ?? target) + "' did not match any file(s) known to git", 'r');
  return false;
}

/** `git checkout <file>` throws away unstaged changes, like `git restore <file>`, and says how many files it touched. */
function checkoutPaths(ctx: Ctx, paths: string[]): boolean {
  const L = ctx.world.local!;
  const all = paths.includes('.') ? Object.keys(L.index) : paths.filter((p) => p in L.index);
  let n = 0;
  for (const p of new Set(all)) {
    if (L.work[p] === L.index[p]) continue;
    L.work[p] = L.index[p]!;
    n++;
  }
  ctx.out.print('Updated ' + n + ' path' + (n === 1 ? '' : 's') + ' from the index');
  return true;
}

/* ---------------- git branch ---------------- */

const USAGE =
  'usage: git branch [<options>] [-r | -a] [--merged] [--no-merged]\n' +
  '   or: git branch [<options>] [-f] [--recurse-submodules] <branch-name> [<start-point>]\n' +
  '   or: git branch [<options>] [-l] [<pattern>...]\n' +
  '   or: git branch [<options>] [-r] (-d | -D) <branch-name>...\n' +
  '   or: git branch [<options>] (-m | -M) [<old-branch>] <new-branch>\n' +
  '   or: git branch [<options>] (-c | -C) [<old-branch>] <new-branch>\n' +
  '   or: git branch [<options>] [-r | -a] [--points-at]\n' +
  '   or: git branch [<options>] [-r | -a] [--format]';

const LIST_FLAGS = ['-a', '--all', '-r', '--remotes', '-l', '--list', '-v', '-vv', '--verbose'];

/**
 * git branch [-a | -r | -v | -vv | --show-current]
 * git branch <name> [<start>] · -m [<old>] <new> · -d | -D <name>... · -u <upstream> [<name>]
 */
export function gitBranch(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const flags = new Set<string>();
  const names: string[] = [];
  let upstream: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--') {
      names.push(...args.slice(i + 1));
      break;
    }
    if (a === '-u' || a === '--set-upstream-to') {
      upstream = args[++i];
      if (upstream === undefined) {
        out.print(a === '-u' ? "error: switch `u' requires a value" : "error: option `set-upstream-to' requires a value", 'r');
        return false;
      }
    } else if (a.startsWith('--set-upstream-to=')) upstream = a.slice(18);
    else if (['-d', '--delete', '-D', '-m', '--move', '-M', '--show-current', ...LIST_FLAGS].includes(a)) flags.add(a);
    else if (a.startsWith('-')) return notBuilt(ctx, 'branch', a);
    else names.push(a);
  }
  const has = (...f: string[]) => f.some((x) => flags.has(x));

  if (has('--show-current')) {
    const b = headBranch(L);
    if (b) out.print(b);
    return true;
  }
  const deleting = has('-d', '--delete', '-D');
  const moving = has('-m', '--move', '-M');
  if (!deleting && !moving && upstream === undefined && (!names.length || has('-l', '--list'))) return listBranches(ctx, flags);
  if (lockedTip(ctx, 'branch create')) return false;
  if (upstream !== undefined) return setUpstream(ctx, upstream, names[0]);
  if (deleting) return deleteBranches(ctx, names, has('-D'));
  if (moving) return renameBranch(ctx, names, has('-M'));
  if (names.length > 2) {
    out.print(USAGE, 'r');
    return false;
  }
  const [name, start] = names as [string, string | undefined];
  if (!isValidBranchName(name)) return invalidName(out, name);
  if (name in L.branches) return alreadyExists(out, name);
  const at = startPoint(L, start);
  if (!at) {
    out.print("fatal: not a valid object name: '" + start + "'", 'r');
    return false;
  }
  L.branches[name] = at.id;
  if (at.track) {
    L.upstream[name] = at.track;
    out.print("branch '" + name + "' set up to track 'origin/" + at.track + "'.");
  }
  return true;
}

function listBranches(ctx: Ctx, flags: Set<string>): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const current = headBranch(L);
  const remotesOnly = flags.has('-r') || flags.has('--remotes');
  const showRemote = remotesOnly || flags.has('-a') || flags.has('--all');
  const verbose = flags.has('-vv') ? 2 : flags.has('-v') || flags.has('--verbose') ? 1 : 0;
  if (!remotesOnly) {
    const names = Object.keys(L.branches).sort();
    const width = Math.max(...names.map((b) => b.length));
    for (const b of names) {
      const mark = b === current ? '* ' : '  ';
      const tone = b === current ? 'g' : '';
      if (!verbose) {
        out.line([[mark], [b, tone]]);
        continue;
      }
      const c = L.commits[L.branches[b]!]!;
      out.line([[mark], [b.padEnd(width), tone], [' ' + short(c.id) + ' ' + trackingBrackets(L, b, verbose) + firstLine(c.message)]]);
    }
  }
  if (showRemote) {
    const prefix = remotesOnly ? 'origin/' : 'remotes/origin/';
    out.line([['  ' + prefix + 'HEAD', 'r'], [' -> origin/' + L.remoteHead]]);
    for (const b of Object.keys(L.remoteBranches).sort()) out.line([['  ' + prefix + b, 'r']]);
  }
  return true;
}

/** "[origin/main: ahead 1] " for -vv, "[ahead 1] " for -v. */
function trackingBrackets(L: LocalRepo, branch: string, verbose: number): string {
  const { ahead, behind, upstream } = aheadBehind(L, branch);
  if (!upstream) return '';
  const counts = !(upstream in L.remoteBranches)
    ? 'gone'
    : [ahead && 'ahead ' + ahead, behind && 'behind ' + behind].filter(Boolean).join(', ');
  if (verbose === 2) return '[origin/' + upstream + (counts ? ': ' + counts : '') + '] ';
  return counts ? '[' + counts + '] ' : '';
}

function setUpstream(ctx: Ctx, ref: string, name: string | undefined): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const branch = name ?? headBranch(L);
  if (!branch || !(branch in L.branches)) {
    out.print("fatal: branch '" + branch + "' does not exist", 'r');
    return false;
  }
  const up = remoteName(L, ref);
  if (!up) {
    out.print("fatal: the requested upstream branch '" + ref + "' does not exist", 'r');
    out.print(
      'hint:\nhint: If you are planning on basing your work on an upstream\nhint: branch that already exists at the remote, you may need to\n' +
        'hint: run "git fetch" to retrieve it.\nhint:\nhint: If you are planning to push out a new local branch that\n' +
        'hint: will track its remote counterpart, you may want to use\nhint: "git push -u" to set the upstream config as you push.\n' +
        'hint: Disable this message with "git config set advice.setUpstreamFailure false"',
      'y',
    );
    return false;
  }
  L.upstream[branch] = up;
  out.print("branch '" + branch + "' set up to track 'origin/" + up + "'.");
  return true;
}

function renameBranch(ctx: Ctx, names: string[], force: boolean): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  if (!names.length) {
    out.print('fatal: branch name required', 'r');
    return false;
  }
  if (names.length > 2) {
    out.print('fatal: too many arguments for a rename operation', 'r');
    return false;
  }
  const [from, to] = names.length === 2 ? (names as [string, string]) : [headBranch(L) ?? 'HEAD', names[0]!];
  if (!(from in L.branches)) {
    out.print("fatal: no branch named '" + from + "'", 'r');
    return false;
  }
  if (!isValidBranchName(to)) return invalidName(out, to);
  if (from === to) return true;
  if (to in L.branches && !force) return alreadyExists(out, to);
  L.branches[to] = L.branches[from]!;
  delete L.branches[from];
  if (from in L.upstream) L.upstream[to] = L.upstream[from]!;
  delete L.upstream[from];
  if (headBranch(L) === from) L.head = { kind: 'branch', name: to };
  if (L.previous === from) L.previous = to;
  return true;
}

function deleteBranches(ctx: Ctx, names: string[], force: boolean): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  if (!names.length) {
    out.print('fatal: branch name required', 'r');
    return false;
  }
  let ok = true;
  for (const name of names) {
    const tip = L.branches[name];
    if (name === headBranch(L)) {
      out.print("error: cannot delete branch '" + name + "' used by worktree at '/home/dev/" + L.dir + "'", 'r');
      ok = false;
    } else if (!tip) {
      out.print("error: branch '" + name + "' not found", 'r');
      ok = false;
    } else if (!force && !mergedEnough(out, L, name, tip)) {
      out.print("error: the branch '" + name + "' is not fully merged", 'r');
      out.print(
        "hint: If you are sure you want to delete it, run 'git branch -D " + name + "'\n" +
          'hint: Disable this message with "git config set advice.forceDeleteBranch false"',
        'y',
      );
      ok = false;
    } else {
      delete L.branches[name];
      delete L.upstream[name];
      out.print('Deleted branch ' + name + ' (was ' + short(tip) + ').');
    }
  }
  return ok;
}

/** git's rule for `branch -d`: merged into the upstream when there is one, else into HEAD. Warns when the two disagree. */
function mergedEnough(out: Out, L: LocalRepo, name: string, tip: string): boolean {
  const head = headId(L);
  const inHead = !!head && isAncestor(L.commits, tip, head);
  const up = L.upstream[name];
  const upTip = up ? L.remoteBranches[up] : undefined;
  if (!upTip) return inHead;
  const merged = isAncestor(L.commits, tip, upTip);
  const ref = "'refs/remotes/origin/" + up + "'";
  if (merged && !inHead) out.print("warning: deleting branch '" + name + "' that has been merged to\n         " + ref + ', but not yet merged to HEAD');
  if (!merged && inHead) out.print("warning: not deleting branch '" + name + "' that is not yet merged to\n         " + ref + ', even though it is merged to HEAD');
  return merged;
}
