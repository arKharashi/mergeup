import type { Ctx } from '../context';
import { aheadBehind, computeStatus, headBranch, isClean } from '../repo';
import type { LocalRepo, StatusEntry } from '../types';
import type { Out } from '../output';

export function printEntries(out: Out, entries: StatusEntry[], tone: 'g' | 'r'): void {
  for (const x of entries) out.line([['\t' + (x.kind + ':').padEnd(12) + x.path, tone]]);
}

/** How a branch stands against its upstream, as `git status` and `git switch` word it. Null without an upstream. */
export function trackingInfo(L: LocalRepo, branch: string): string | null {
  const { ahead, behind, upstream } = aheadBehind(L, branch);
  if (!upstream) return null;
  const up = "'origin/" + upstream + "'";
  const s = (n: number) => (n > 1 ? 's' : '');
  if (!(upstream in L.remoteBranches)) {
    return 'Your branch is based on ' + up + ', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)';
  }
  if (ahead && behind) {
    return (
      'Your branch and ' + up + ' have diverged,\nand have ' + ahead + ' and ' + behind +
      ' different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)'
    );
  }
  if (ahead) return 'Your branch is ahead of ' + up + ' by ' + ahead + ' commit' + s(ahead) + '.\n  (use "git push" to publish your local commits)';
  if (behind) {
    return (
      'Your branch is behind ' + up + ' by ' + behind + ' commit' + s(behind) +
      ', and can be fast-forwarded.\n  (use "git pull" to update your local branch)'
    );
  }
  return 'Your branch is up to date with ' + up + '.';
}

function printTracking(out: Out, L: LocalRepo, branch: string): void {
  const info = trackingInfo(L, branch);
  if (info) out.print(info + '\n');
}

export function gitStatus(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const st = computeStatus(L);
  if (args.includes('-s') || args.includes('--short')) {
    const rows = new Map<string, [string, string]>();
    for (const x of st.staged) rows.set(x.path, [x.kind === 'new file' ? 'A' : x.kind === 'deleted' ? 'D' : 'M', ' ']);
    for (const x of st.unstaged) {
      const r = rows.get(x.path) ?? [' ', ' '];
      r[1] = x.kind === 'deleted' ? 'D' : 'M';
      rows.set(x.path, r);
    }
    // git sorts paths by bytes, so README.md comes before about.html.
    for (const [p, [i, w]] of [...rows].sort((a, b) => (a[0] < b[0] ? -1 : 1))) out.line([[i, 'g'], [w, 'r'], [' ' + p]]);
    for (const p of st.untracked) out.line([['??', 'r'], [' ' + p]]);
    return true;
  }
  const branch = headBranch(L);
  if (branch) {
    out.print('On branch ' + branch);
    printTracking(out, L, branch);
  } else {
    out.line([['HEAD detached at ' + (L.head.kind === 'detached' ? L.head.id.slice(0, 7) : ''), 'r']]);
  }
  if (st.staged.length) {
    out.print('Changes to be committed:\n  (use "git restore --staged <file>..." to unstage)');
    printEntries(out, st.staged, 'g');
    out.print('');
  }
  if (st.unstaged.length) {
    out.print(
      'Changes not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n' +
        '  (use "git restore <file>..." to discard changes in working directory)',
    );
    printEntries(out, st.unstaged, 'r');
    out.print('');
  }
  if (st.untracked.length) {
    out.print('Untracked files:\n  (use "git add <file>..." to include in what will be committed)');
    for (const p of st.untracked) out.line([['\t' + p, 'r']]);
    out.print('');
  }
  if (isClean(st)) out.print('nothing to commit, working tree clean');
  else if (!st.staged.length && st.unstaged.length) out.print('no changes added to commit (use "git add" and/or "git commit -a")');
  else if (!st.staged.length && st.untracked.length) out.print('nothing added to commit but untracked files present (use "git add" to track)');
  return true;
}
