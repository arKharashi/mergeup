import type { Ctx, PushRejection } from '../context';
import { treeDiff } from '../diff';
import { short } from '../hash';
import { notePush, openPullFor } from '../host';
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
    out.tip({
      ar: 'تأكد من الرابط. انسخه من رسالة أبو فهد بالضبط.',
      en: 'Check the link. Copy it exactly from Abu Fahd’s message.',
    });
    return false;
  }
  if (world.local) {
    out.print("fatal: destination path '" + world.local.dir + "' already exists and is not an empty directory.", 'r');
    out.tip({
      ar: 'المشروع عندك من قبل. ادخله بـ `cd ' + world.local.dir + '`',
      en: 'You already have the project. Go in with `cd ' + world.local.dir + '`',
    });
    return false;
  }
  if (world.cwd !== '~') {
    out.print("fatal: could not create work tree dir '" + dir + "': Permission denied", 'r');
    out.tip({ ar: 'ارجع لمجلد البداية بـ `cd ~` وبعدها استنسخ.', en: 'Go back to your home folder with `cd ~`, then clone.' });
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
  out.tip({
    ar: 'المشروع صار عندك في مجلد `' + dir + '`. ادخله بـ `cd ' + dir + '`',
    en: 'The project is now in the `' + dir + '` folder. Go in with `cd ' + dir + '`',
  });
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
      out.tip({
        ar: 'الـ force push يعيد كتابة تاريخ الفريق. تتعلم متى يكون آمن في رتبة ' + rank + '. الحين ادفع بدون `--force`.',
        en: 'A force push rewrites the team’s history. You’ll learn when it’s safe at the ' + rank + ' rank. For now, push without `--force`.',
      });
      return false;
    }
  }

  // Which local branch goes to which remote branch. `label` is the source as typed, e.g. HEAD.
  const current = headBranch(L);
  let src: string;
  let dst: string;
  let label: string;
  const spec = positional[1];
  if (spec) {
    const [a, b] = spec.split(':');
    src = a === 'HEAD' ? (current ?? '') : a!;
    dst = b || src;
    label = a || src;
    if (!src || !(src in L.branches)) {
      out.print('error: src refspec ' + (a ?? spec) + " does not match any\nerror: failed to push some refs to '" + L.url + "'", 'r');
      return false;
    }
  } else {
    if (!current) {
      out.print('fatal: You are not currently on a branch.', 'r');
      return false;
    }
    src = label = current;
    const up = L.upstream[current];
    // push.default=simple: without a refspec, -u doesn't help a branch with no upstream yet.
    if (!up) {
      out.print(
        'fatal: The current branch ' + current + ' has no upstream branch.\n' +
          'To push the current branch and set the remote as upstream, use\n\n' +
          '    git push --set-upstream origin ' + current + '\n\n' +
          'To have this happen automatically for branches without a tracking\n' +
          "upstream, see 'push.autoSetupRemote' in 'git help config'.\n",
        'r',
      );
      out.tip({
        ar: 'أول مرة ترفع فرع جديد لازم تقول لـ git وين يروح: `git push -u origin ' + current + '`',
        en: 'The first time you push a new branch, tell git where it goes: `git push -u origin ' + current + '`',
      });
      return false;
    }
    if (up !== current) {
      out.print(
        'fatal: The upstream branch of your current branch does not match\n' +
          'the name of your current branch.  To push to the upstream branch\n' +
          'on the remote, use\n\n    git push origin HEAD:' + up + '\n\n' +
          'To push to the branch of the same name on the remote, use\n\n    git push origin HEAD\n\n' +
          "To choose either option permanently, see push.default in 'git help config'.\n\n" +
          'To avoid automatically configuring an upstream branch when its name\n' +
          "won't match the local branch, see option 'simple' of branch.autoSetupMerge\nin 'git help config'.\n",
        'r',
      );
      return false;
    }
    dst = up;
  }

  const localTip = L.branches[src]!;
  const remoteTip = remote.branches[dst];
  const track = () => {
    if (!setUpstream || L.upstream[src] === dst) return;
    L.upstream[src] = dst;
    out.print("branch '" + src + "' set up to track 'origin/" + dst + "'.");
  };

  if (remoteTip === localTip) {
    track();
    out.print('Everything up-to-date');
    if (!isClean(computeStatus(L))) {
      out.tip({
        ar: 'ما فيه commits جديدة ترفعها. التعديلات عندك ما تسجّلت للحين: `git add` ثم `git commit` قبل `git push`.',
        en: 'There are no new commits to push. Your changes aren’t committed yet: `git add`, then `git commit`, before `git push`.',
      });
    }
    return true;
  }

  const rejected = (reason: Exclude<PushRejection, 'protected'>, hint?: string) => {
    out.print('To ' + L.url);
    out.line([[' ! [rejected]        ' + label + ' -> ' + dst + ' (' + reason + ')', 'r']]);
    out.print("error: failed to push some refs to '" + L.url + "'", 'r');
    if (hint) out.print(hint, 'y');
    ctx.hooks.onPushRejected?.(dst, reason);
    return false;
  };

  if (remote.protectedBranches.includes(dst)) {
    out.print('remote: error: Changes to ' + dst + ' must be made through a pull request.');
    out.print('To ' + L.url);
    out.line([[' ! [remote rejected] ' + label + ' -> ' + dst + ' (protected branch hook declined)', 'r']]);
    out.print("error: failed to push some refs to '" + L.url + "'", 'r');
    out.tip({
      ar: 'الفرع `' + dst + '` محمي. اشتغل على فرع خاص فيك وافتح طلب دمج (PR).',
      en: 'The `' + dst + '` branch is protected. Work on a branch of your own and open a pull request (PR).',
    });
    ctx.hooks.onPushRejected?.(dst, 'protected');
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
      out.tip({
        ar: 'أحد من الفريق رفع شغل قبلك. اسحبه أول بـ `git pull` وبعدها ارفع.',
        en: 'Someone on the team pushed before you. Pull their work first with `git pull`, then push.',
      });
      return false;
    } else {
      rejected(
        'non-fast-forward',
        'hint: Updates were rejected because the tip of your current branch is behind\n' +
          'hint: its remote counterpart. If you want to integrate the remote changes,\n' +
          "hint: use 'git pull' before pushing again.",
      );
      if (isAncestor(L.commits, localTip, remoteTip)) {
        out.tip({
          ar: 'فرعك متأخر عن نسخة الفريق. اسحب التحديثات بـ `git pull` قبل الرفع.',
          en: 'Your branch is behind the team’s copy. Get the updates with `git pull` before you push.',
        });
      } else {
        out.tip({
          ar: 'تاريخك صار مختلف عن نسخة الفريق، غالباً لأنك عدّلت commit سبق ورفعته (مثلاً بـ `--amend`). في هذي المرحلة الأسهل تضغط «رجّع الوقت» وتعيد.',
          en: 'Your history no longer matches the team’s, usually because you changed a commit you had already pushed (with `--amend`, for example). At this stage the easiest fix is to press "Rewind" and start over.',
        });
      }
      return false;
    }
  }

  const fresh = missingCommits(L.commits, localTip, remote.commits);
  for (const c of fresh) remote.commits[c.id] = c;
  remote.branches[dst] = localTip;
  L.remoteBranches[dst] = localTip;
  // The host adds the new commits to an open pull request from this branch.
  const pr = openPullFor(remote, dst);
  if (pr) notePush(remote, pr, world.now());

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
  if (!remoteTip) out.print(' * [new branch]      ' + label + ' -> ' + dst);
  else if (forced) out.print(' + ' + short(remoteTip) + '...' + short(localTip) + ' ' + label + ' -> ' + dst + ' (forced update)');
  else out.print('   ' + short(remoteTip) + '..' + short(localTip) + '  ' + label + ' -> ' + dst);
  track();
  ctx.hooks.onPush?.(fresh, dst);
  return true;
}

/* ---------------- remote ---------------- */

export function gitRemote(ctx: Ctx, args: string[]): boolean {
  const url = (ctx.world.local as LocalRepo).url;
  if (args.includes('-v') || args.includes('--verbose')) ctx.out.print('origin\t' + url + ' (fetch)\norigin\t' + url + ' (push)');
  else if (args[0] === 'get-url') ctx.out.print(url);
  else if (args.length && args[0] !== 'show') {
    ctx.out.tip({
      ar: 'إعدادات الـ remote جاهزة من الفريق، ما تحتاج تغيّرها.',
      en: 'The team already set up the remote, so you don’t need to change it.',
    });
    return false;
  } else ctx.out.print('origin');
  return true;
}
