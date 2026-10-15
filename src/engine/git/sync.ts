import type { Ctx } from '../context';
import { treeDiff } from '../diff';
import { short } from '../hash';
import { cloneRepo, computeStatus, headBranch, headId, headTree, isAncestor, isClean, setHead } from '../repo';
import type { Commit, LocalRepo, RemoteRepo } from '../types';
import { printStat } from './format';

const normalizeUrl = (u: string) =>
  u.trim().replace(/\/+$/, '').replace(/\.git$/, '').replace(/^git@([^:]+):/, 'https://$1/').replace(/^http:\/\//, 'https://');

const displayUrl = (u: string) => u.replace(/\.git$/, '');

/** Commits reachable from `tip` that `known` doesn't have, oldest first. */
function missingCommits(from: Record<string, Commit>, tip: string, known: Record<string, Commit>): Commit[] {
  const out: Commit[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id) || known[id] || !from[id]) return;
    seen.add(id);
    for (const p of from[id].parents) visit(p);
    out.push(from[id]);
  };
  visit(tip);
  return out;
}

/* ---------------- clone ---------------- */

export function gitClone(ctx: Ctx, args: string[]): boolean {
  const { out, world } = ctx;
  const positional = args.filter((a) => !a.startsWith('-'));
  const url = positional[0];
  if (!url) {
    out.print('fatal: You must specify a repository to clone.', 'r');
    return false;
  }
  const defaultDir = (url.replace(/\/+$/, '').split(/[/:]/).pop() ?? 'repo').replace(/\.git$/, '');
  const dir = positional[1] ?? defaultDir;
  if (normalizeUrl(url) !== normalizeUrl(world.remote.url)) {
    out.print("Cloning into '" + dir + "'...");
    out.print("remote: Repository not found.\nfatal: repository '" + url + "' not found", 'r');
    out.tip('تأكد من الرابط. انسخه من رسالة أبو فهد بالضبط.');
    return false;
  }
  if (world.local) {
    out.print("fatal: destination path '" + world.local.dir + "' already exists and is not an empty directory.", 'r');
    out.tip('المشروع عندك من قبل. ادخله بـ `cd ' + world.local.dir + '`');
    return false;
  }
  if (world.cwd !== '~') {
    out.print("fatal: could not create work tree dir '" + dir + "': Permission denied", 'r');
    out.tip('ارجع لمجلد البداية بـ `cd ~` وبعدها استنسخ.');
    return false;
  }
  if (!/^[\w.-]+$/.test(dir)) {
    out.print("fatal: could not create work tree dir '" + dir + "': Invalid argument", 'r');
    return false;
  }
  const n = Object.keys(world.remote.commits).length;
  const objs = n * 3 + 4;
  out.print("Cloning into '" + dir + "'...");
  out.print(
    'remote: Enumerating objects: ' + objs + ', done.\n' +
      'remote: Counting objects: 100% (' + objs + '/' + objs + '), done.\n' +
      'remote: Compressing objects: 100% (' + (objs - 5) + '/' + (objs - 5) + '), done.\n' +
      'remote: Total ' + objs + ' (delta 4), reused ' + (objs - 6) + ' (delta 2), pack-reused 0\n' +
      'Receiving objects: 100% (' + objs + '/' + objs + '), 3.12 KiB | 3.12 MiB/s, done.\n' +
      'Resolving deltas: 100% (4/4), done.',
  );
  world.local = cloneRepo(world.remote, dir);
  out.tip('المشروع صار عندك في مجلد `' + dir + '`. ادخله بـ `cd ' + dir + '`');
  return true;
}

/* ---------------- fetch ---------------- */

/** Copies the remote's commits and branches into origin/*. Returns the printed lines. */
function fetchInto(L: LocalRepo, remote: RemoteRepo): string[] {
  for (const [id, c] of Object.entries(remote.commits)) if (!L.commits[id]) L.commits[id] = c;
  const lines: string[] = [];
  for (const [b, tip] of Object.entries(remote.branches)) {
    const old = L.remoteBranches[b];
    if (old === tip) continue;
    if (!old) lines.push(' * [new branch]      ' + b.padEnd(10) + ' -> origin/' + b);
    else if (isAncestor(L.commits, old, tip)) lines.push('   ' + short(old) + '..' + short(tip) + '  ' + b.padEnd(10) + ' -> origin/' + b);
    else lines.push(' + ' + short(old) + '...' + short(tip) + ' ' + b.padEnd(10) + ' -> origin/' + b + '  (forced update)');
    L.remoteBranches[b] = tip;
  }
  return lines;
}

export function gitFetch(ctx: Ctx): boolean {
  const L = ctx.world.local!;
  const lines = fetchInto(L, ctx.world.remote);
  if (lines.length) ctx.out.print('From ' + displayUrl(L.url) + '\n' + lines.join('\n'));
  return true;
}

/* ---------------- pull (fast-forward only, for now) ---------------- */

export function gitPull(ctx: Ctx): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const branch = headBranch(L);
  const up = branch ? L.upstream[branch] : undefined;
  if (!branch || !up) {
    out.print('There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.', 'r');
    return false;
  }
  const lines = fetchInto(L, ctx.world.remote);
  if (lines.length) out.print('From ' + displayUrl(L.url) + '\n' + lines.join('\n'));
  const mine = headId(L)!;
  const theirs = L.remoteBranches[up];
  if (!theirs || isAncestor(L.commits, theirs, mine)) {
    out.print('Already up to date.');
    return true;
  }
  if (!isAncestor(L.commits, mine, theirs)) {
    out.print(
      'hint: You have divergent branches and need to specify how to reconcile them.\n' +
        'hint: You can do so by running one of the following commands sometime before\n' +
        'hint: your next pull:\nhint:\n' +
        'hint:   git config pull.rebase false  # merge\n' +
        'hint:   git config pull.rebase true   # rebase\n' +
        'hint:   git config pull.ff only       # fast-forward only\nhint:',
      'y',
    );
    out.print('fatal: Need to specify how to reconcile divergent branches.', 'r');
    return false;
  }
  const from = headTree(L);
  const to = L.commits[theirs]!.tree;
  const changed = treeDiff(from, to);
  const dirty = changed.filter((p) => L.work[p] !== from[p] || L.index[p] !== from[p]);
  if (dirty.length) {
    out.print(
      'error: Your local changes to the following files would be overwritten by merge:\n\t' + dirty.join('\n\t') +
        '\nPlease commit your changes or stash them before you merge.\nAborting',
      'r',
    );
    return false;
  }
  out.print('Updating ' + short(mine) + '..' + short(theirs) + '\nFast-forward');
  printStat(out, from, to);
  setHead(L, theirs);
  for (const p of changed) {
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

/* ---------------- push ---------------- */

export function gitPush(ctx: Ctx, args: string[]): boolean {
  const { out, world } = ctx;
  const L = world.local!;
  const remote = world.remote;
  const setUpstream = args.includes('-u') || args.includes('--set-upstream');
  const force = args.includes('-f') || args.includes('--force');
  const lease = args.includes('--force-with-lease');
  const positional = args.filter((a) => !a.startsWith('-'));

  if (positional[0] && positional[0] !== 'origin') {
    out.print("fatal: '" + positional[0] + "' does not appear to be a git repository\nfatal: Could not read from remote repository.", 'r');
    return false;
  }
  if (force || lease) {
    const rank = ctx.lockedUntil('push --force');
    if (rank) {
      out.tip('الـ force push يعيد كتابة تاريخ الفريق. تتعلم متى يكون آمن في رتبة ' + rank + '. الحين ادفع بدون `--force`.');
      return false;
    }
  }

  // Which local branch goes to which remote branch.
  const current = headBranch(L);
  let src: string;
  let dst: string;
  const spec = positional[1];
  if (spec) {
    const [a, b] = spec.split(':');
    src = a === 'HEAD' ? (current ?? '') : a!;
    dst = b || src;
    if (!src || !(src in L.branches)) {
      out.print('error: src refspec ' + (a ?? spec) + " does not match any\nerror: failed to push some refs to '" + L.url + "'", 'r');
      return false;
    }
  } else {
    if (!current) {
      out.print('fatal: You are not currently on a branch.', 'r');
      return false;
    }
    src = current;
    const up = L.upstream[current];
    if (!up && !setUpstream) {
      out.print(
        'fatal: The current branch ' + current + ' has no upstream branch.\n' +
          'To push the current branch and set the remote as upstream, use\n\n' +
          '    git push --set-upstream origin ' + current + '\n',
        'r',
      );
      out.tip('أول مرة ترفع فرع جديد لازم تقول لـ git وين يروح: `git push -u origin ' + current + '`');
      return false;
    }
    dst = up ?? current;
  }

  const localTip = L.branches[src]!;
  const remoteTip = remote.branches[dst];

  if (remoteTip === localTip) {
    out.print('Everything up-to-date');
    if (!isClean(computeStatus(L))) {
      out.tip('ما فيه commits جديدة ترفعها. التعديلات عندك ما تسجّلت للحين: `git add` ثم `git commit` قبل `git push`.');
    }
    return true;
  }

  const rejected = (reason: string, hint?: string) => {
    out.print('To ' + L.url);
    out.line([[' ! [rejected]        ' + src + ' -> ' + dst + ' (' + reason + ')', 'r']]);
    out.print("error: failed to push some refs to '" + L.url + "'", 'r');
    if (hint) out.print(hint, 'y');
    return false;
  };

  if (remote.protectedBranches.includes(dst)) {
    out.print('remote: error: Changes to ' + dst + ' must be made through a pull request.');
    out.print('To ' + L.url);
    out.line([[' ! [remote rejected] ' + src + ' -> ' + dst + ' (protected branch hook declined)', 'r']]);
    out.print("error: failed to push some refs to '" + L.url + "'", 'r');
    out.tip('الفرع `' + dst + '` محمي. اشتغل على فرع خاص فيك وافتح طلب دمج (PR).');
    return false;
  }

  let forced = false;
  if (remoteTip && !isAncestor(L.commits, remoteTip, localTip)) {
    const known = !!L.commits[remoteTip];
    if (lease) {
      if (L.remoteBranches[dst] !== remoteTip) return rejected('stale info');
      forced = true;
    } else if (force) {
      forced = true;
    } else if (!known) {
      rejected(
        'fetch first',
        'hint: Updates were rejected because the remote contains work that you do not\n' +
          'hint: have locally. This is usually caused by another repository pushing to\n' +
          "hint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.",
      );
      out.tip('أحد من الفريق رفع شغل قبلك. اسحبه أول بـ `git pull` وبعدها ارفع.');
      return false;
    } else {
      rejected(
        'non-fast-forward',
        'hint: Updates were rejected because the tip of your current branch is behind\n' +
          'hint: its remote counterpart. If you want to integrate the remote changes,\n' +
          "hint: use 'git pull' before pushing again.",
      );
      if (isAncestor(L.commits, localTip, remoteTip)) {
        out.tip('فرعك متأخر عن نسخة الفريق. اسحب التحديثات بـ `git pull` قبل الرفع.');
      } else {
        out.tip('تاريخك صار مختلف عن نسخة الفريق، غالباً لأنك عدّلت commit سبق ورفعته (مثلاً بـ `--amend`). في هذي المرحلة الأسهل تضغط «رجّع الوقت» وتعيد.');
      }
      return false;
    }
  }

  const fresh = missingCommits(L.commits, localTip, remote.commits);
  for (const c of fresh) remote.commits[c.id] = c;
  remote.branches[dst] = localTip;
  L.remoteBranches[dst] = localTip;

  const objs = Math.max(3, fresh.length * 3);
  out.print(
    'Enumerating objects: ' + (objs + 2) + ', done.\n' +
      'Counting objects: 100% (' + (objs + 2) + '/' + (objs + 2) + '), done.\n' +
      'Delta compression using up to 8 threads\n' +
      'Compressing objects: 100% (' + objs + '/' + objs + '), done.\n' +
      'Writing objects: 100% (' + objs + '/' + objs + '), 412 bytes | 412.00 KiB/s, done.\n' +
      'Total ' + objs + ' (delta 1), reused 0 (delta 0), pack-reused 0',
  );
  out.print('To ' + L.url);
  if (!remoteTip) out.print(' * [new branch]      ' + src + ' -> ' + dst);
  else if (forced) out.print(' + ' + short(remoteTip) + '...' + short(localTip) + ' ' + src + ' -> ' + dst + ' (forced update)');
  else out.print('   ' + short(remoteTip) + '..' + short(localTip) + '  ' + src + ' -> ' + dst);
  if (setUpstream && L.upstream[src] !== dst) {
    L.upstream[src] = dst;
    out.print("branch '" + src + "' set up to track 'origin/" + dst + "'.");
  }
  ctx.hooks.onPush?.(fresh, dst);
  return true;
}

/* ---------------- remote ---------------- */

export function gitRemote(ctx: Ctx, args: string[]): boolean {
  const url = (ctx.world.local as LocalRepo).url;
  if (args.includes('-v') || args.includes('--verbose')) ctx.out.print('origin\t' + url + ' (fetch)\norigin\t' + url + ' (push)');
  else if (args[0] === 'get-url') ctx.out.print(url);
  else if (args.length && args[0] !== 'show') {
    ctx.out.tip('إعدادات الـ remote جاهزة من الفريق، ما تحتاج تغيّرها.');
    return false;
  } else ctx.out.print('origin');
  return true;
}
