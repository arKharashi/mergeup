import { isWeakMessage } from '../commitMessage';
import type { Ctx } from '../context';
import { countChanges, treeDiff } from '../diff';
import { short } from '../hash';
import { computeStatus, firstLine, headBranch, headId, headTree, makeCommit, setHead } from '../repo';
import { changeSummary } from './format';
import { printEntries } from './status';

/** git commit -m <msg> [-m <more>] [-a] [--amend] [--no-edit] */
export function gitCommit(ctx: Ctx, args: string[]): boolean {
  const L = ctx.world.local!;
  const { out } = ctx;
  const msgs: string[] = [];
  let all = false;
  let amend = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '-m' || a === '--message' || a === '-am' || a === '-ma') {
      if (a === '-am' || a === '-ma') all = true;
      const v = args[++i];
      if (v === undefined) {
        out.print("error: switch `m' requires a value", 'r');
        return false;
      }
      msgs.push(v);
    } else if (a.startsWith('--message=')) msgs.push(a.slice(10));
    else if (a === '-a' || a === '--all') all = true;
    else if (a === '--amend') amend = true;
    else if (a === '--no-edit') continue;
    else if (/^-m./.test(a)) msgs.push(a.slice(2));
    else {
      out.print("error: unknown option `" + a.replace(/^-+/, '') + "'", 'r');
      return false;
    }
  }

  if (all) {
    for (const p of Object.keys(L.index)) {
      if (p in L.work) L.index[p] = L.work[p]!;
      else delete L.index[p];
    }
  }

  const head = headId(L);
  if (amend && !head) {
    out.print('fatal: You have nothing to amend.', 'r');
    return false;
  }
  const parents = amend ? L.commits[head!]!.parents : head ? [head] : [];
  const parentTree = parents[0] ? L.commits[parents[0]]!.tree : {};

  if (!amend && treeDiff(headTree(L), L.index).length === 0) {
    const st = computeStatus(L);
    out.print('On branch ' + (headBranch(L) ?? 'HEAD'));
    if (st.unstaged.length) {
      out.print('Changes not staged for commit:');
      printEntries(out, st.unstaged, 'r');
      out.print('\nno changes added to commit (use "git add" and/or "git commit -a")');
      out.tip({
        ar: 'التعديلات موجودة بس ما جهّزتها. استخدم `git add` قبل `git commit`.',
        en: 'You have changes, but none of them are staged. Use `git add` before `git commit`.',
      });
    } else if (st.untracked.length) {
      out.print('Untracked files:');
      for (const p of st.untracked) out.line([['\t' + p, 'r']]);
      out.print('\nnothing added to commit but untracked files present (use "git add" to track)');
    } else {
      out.print('nothing to commit, working tree clean');
    }
    return false;
  }

  let message = msgs.join('\n\n');
  if (!message && amend) message = L.commits[head!]!.message;
  if (!message) {
    out.print('Aborting commit due to empty commit message.', 'r');
    out.tip({
      ar: 'اكتب الرسالة مع الأمر: `git commit -m "وصف التعديل"`',
      en: 'Write the message with the command: `git commit -m "Describe the change"`',
    });
    return false;
  }

  const c = makeCommit({ tree: { ...L.index }, message, author: ctx.world.me, time: ctx.world.now(), parents });
  L.commits[c.id] = c;
  setHead(L, c.id);

  const changed = treeDiff(parentTree, c.tree);
  let ins = 0;
  let del = 0;
  for (const p of changed) {
    const r = countChanges(parentTree[p], c.tree[p]);
    ins += r.ins;
    del += r.del;
  }
  const label = (headBranch(L) ?? 'detached HEAD') + (parents.length ? '' : ' (root-commit)');
  out.print('[' + label + ' ' + short(c.id) + '] ' + firstLine(message));
  out.print(' ' + changeSummary(changed.length, ins, del));
  for (const p of changed) {
    if (!(p in parentTree)) out.print(' create mode 100644 ' + p);
    else if (!(p in c.tree)) out.print(' delete mode 100644 ' + p);
  }

  if (isWeakMessage(message)) {
    out.tip({
      ar: 'رسالة الـ commit قصيرة وما توضح وش تغيّر، والفريق بيقرأها بعدين. تقدر تصلحها قبل الـ push: `git commit --amend -m "رسالة أوضح"`',
      en: 'That commit message is short and doesn’t say what changed, and the team will read it later. You can fix it before you push: `git commit --amend -m "A clearer message"`',
    });
  }
  ctx.hooks.onCommit?.(c, changed, parentTree);
  return true;
}
