import type { Ctx } from '../context';
import { headBranch, inRepo } from '../repo';
import { gitCommit } from './commit';
import { gitDiff, gitLog, gitShow } from './history';
import { gitAdd, gitReset, gitRestore, gitRm } from './stage';
import { gitStatus } from './status';
import { gitClone, gitFetch, gitPull, gitPush, gitRemote } from './sync';

type GitCommand = (ctx: Ctx, args: string[]) => boolean;

/** Commands that need to run inside the repository folder. */
const IN_REPO: Record<string, GitCommand> = {
  status: gitStatus,
  add: gitAdd,
  commit: gitCommit,
  push: gitPush,
  pull: (ctx) => gitPull(ctx),
  fetch: (ctx) => gitFetch(ctx),
  log: gitLog,
  show: gitShow,
  diff: gitDiff,
  restore: gitRestore,
  reset: gitReset,
  rm: gitRm,
  remote: gitRemote,
  branch: gitBranch,
  checkout: gitCheckout,
};

/** Real git commands the game knows about but the engine doesn't simulate yet. */
const NOT_YET = ['switch', 'merge', 'stash', 'revert', 'cherry-pick', 'rebase', 'tag', 'reflog', 'bisect', 'blame', 'mv', 'clean'];

const ALL = ['clone', 'init', 'config', 'help', 'version', ...Object.keys(IN_REPO), ...NOT_YET];

export const GIT_SUBCOMMANDS = ['clone', 'status', 'add', 'commit', 'push', 'pull', 'fetch', 'log', 'show', 'diff', 'restore', 'reset', 'rm', 'remote', 'config'];

function printUsage(ctx: Ctx): void {
  ctx.out.print('usage: git <command> [<args>]\n');
  ctx.out.print(
    '   clone      Clone a repository into a new directory\n' +
      '   status     Show the working tree status\n' +
      '   add        Add file contents to the index\n' +
      '   commit     Record changes to the repository\n' +
      '   push       Update remote refs along with associated objects\n' +
      '   pull       Fetch from and integrate with another repository\n' +
      '   log        Show commit logs\n' +
      '   show       Show various types of objects\n' +
      '   diff       Show changes between commits, commit and working tree, etc\n' +
      '   restore    Restore working tree files\n' +
      '   reset      Reset current HEAD to the specified state',
  );
}

export function git(ctx: Ctx, args: string[]): boolean {
  const { out, world } = ctx;
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === '--help' || sub === 'help' || sub === '-h') {
    printUsage(ctx);
    return true;
  }
  if (sub === '--version' || sub === 'version') {
    out.print('git version 2.47.0');
    return true;
  }
  if (!ALL.includes(sub)) {
    out.print("git: '" + sub + "' is not a git command. See 'git --help'.", 'r');
    const near = ALL.find((k) => k.startsWith(sub.slice(0, 3)) && k !== sub);
    if (near) out.print('\nThe most similar command is\n\t' + near);
    return false;
  }

  const rank = ctx.lockedUntil(sub);
  if (rank) {
    out.tip('الأمر `git ' + sub + '` ينفتح لك في رتبة ' + rank + '.');
    return false;
  }

  let ok: boolean;
  if (sub === 'clone') ok = gitClone(ctx, rest);
  else if (sub === 'init') {
    out.tip('ما تحتاج `git init` هنا. المشروع موجود عند الفريق، خذ نسخة منه بـ `git clone` والرابط في رسالة أبو فهد.');
    ok = false;
  } else if (sub === 'config') ok = gitConfig(ctx, rest);
  else if (NOT_YET.includes(sub)) {
    out.tip('الأمر `git ' + sub + '` لسا ما انبنى في المحاكي.');
    ok = false;
  } else if (!inRepo(world)) {
    out.print('fatal: not a git repository (or any of the parent directories): .git', 'r');
    if (world.local) out.tip('أنت برا مجلد المشروع. ادخله بـ `cd ' + world.local.dir + '`');
    else out.tip('ما عندك نسخة من المشروع للحين. ابدأ بـ `git clone` والرابط اللي أرسله أبو فهد.');
    ok = false;
  } else {
    ok = IN_REPO[sub]!(ctx, rest);
  }
  if (ok) ctx.ran[sub] = true;
  return ok;
}

function gitConfig(ctx: Ctx, args: string[]): boolean {
  const { out, world } = ctx;
  const rest = args.filter((a) => a !== '--global' && a !== '--local');
  if (rest[0] === '--list' || rest[0] === '-l') {
    out.print('user.name=' + world.me.name + '\nuser.email=' + world.me.email + '\ninit.defaultbranch=main');
    if (world.local) out.print('remote.origin.url=' + world.local.url + '\nbranch.main.remote=origin\nbranch.main.merge=refs/heads/main');
    return true;
  }
  if (rest[0] === 'user.name' || rest[0] === 'user.email') {
    if (rest.length === 1) {
      out.print(rest[0] === 'user.name' ? world.me.name : world.me.email);
      return true;
    }
    out.tip('اسمك وإيميلك ضبطناها لك من أول يوم، وهي اللي تظهر في الـ commits حقتك.');
    return true;
  }
  if (!rest.length) {
    out.print('usage: git config [<options>]', 'r');
    return false;
  }
  return true;
}

/** git branch (list only for now). Creating branches arrives with the Junior rank. */
function gitBranch(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const listing = args.every((a) => ['-a', '--all', '-r', '--remotes', '-v', '-vv', '--list'].includes(a));
  if (!listing) {
    const rank = ctx.lockedUntil('branch create');
    if (rank) {
      out.tip('إنشاء الفروع ينفتح لك في رتبة ' + rank + '. في رتبة Intern تشتغل على `main` بس.');
      return false;
    }
    out.tip('إنشاء الفروع لسا ما انبنى في المحاكي.');
    return false;
  }
  const current = headBranch(L);
  const showLocal = !args.includes('-r') && !args.includes('--remotes');
  const showRemote = args.some((a) => ['-a', '--all', '-r', '--remotes'].includes(a));
  if (showLocal) {
    for (const b of Object.keys(L.branches).sort()) {
      if (b === current) out.line([['* '], [b, 'g']]);
      else out.print('  ' + b);
    }
  }
  if (showRemote) {
    const prefix = args.includes('-r') || args.includes('--remotes') ? 'origin/' : 'remotes/origin/';
    out.line([['  ' + prefix + 'HEAD', 'r'], [' -> origin/' + L.remoteHead]]);
    for (const b of Object.keys(L.remoteBranches).sort()) out.line([['  ' + prefix + b, 'r']]);
  }
  return true;
}

/** Only `git checkout -- <file>` for now; switching branches arrives with the Junior rank. */
function gitCheckout(ctx: Ctx, args: string[]): boolean {
  if (args[0] === '--') return gitRestore(ctx, args.slice(1));
  const rank = ctx.lockedUntil('switch');
  ctx.out.tip(
    rank
      ? 'التنقل بين الفروع ينفتح لك في رتبة ' + rank + '. لو تبي ترجع ملف لآخر نسخة استخدم `git restore <file>`.'
      : 'التنقل بين الفروع لسا ما انبنى في المحاكي.',
  );
  return false;
}
