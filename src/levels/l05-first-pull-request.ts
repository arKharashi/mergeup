import { cloneOnBranch, isWeakMessage, lines, pullTrees, reviewDecision, type PullRequest, type ReviewComment } from '../engine';
import { runChecks } from '../game/ci';
import type { Level, LevelApi } from '../game/level';
import { ABOUT_JS_FIXED, ENV_FILE, REPO_DIR, bunCafeHistory, withAboutBranch } from './fixtures';

const BRANCH = 'feature/about';

/** Names that say nothing about what they hold. */
const VAGUE = new Set(['d', 'x', 'y', 'n', 'h', 't', 'v', 'a', 'b', 'i', 'tmp', 'temp', 'val', 'data', 'foo', 'bar', 'num', 'date', 'time']);

/** Khalid's comments on about.js, at the lines they belong to. Empty when the script is clean. */
function khalidsComments(js: string | undefined): ReviewComment[] {
  if (js === undefined) return [];
  const code = lines(js);
  const comments: ReviewComment[] = [];
  const at = (re: RegExp) => code.findIndex((l) => !l.trim().startsWith('//') && re.test(l)) + 1;

  const decl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new Date\(\)/;
  const declLine = at(decl);
  const name = declLine ? decl.exec(code[declLine - 1]!)![1]! : null;
  if (name && (VAGUE.has(name) || name.length < 3)) {
    comments.push({
      path: 'about.js',
      line: declLine,
      body: {
        ar: '`' + name + '` اسم ما يقول وش فيه. سمّه باسم يوضح، مثل `hour`، وغيّره في كل مكان يُستخدم فيه.',
        en: '`' + name + '` doesn’t say what it holds. Use a name that does, like `hour`, everywhere it’s used.',
      },
    });
  } else {
    // Renamed where it's declared, but the old name is still used further down.
    const stale = at(/\bd\b/);
    if (stale) {
      comments.push({
        path: 'about.js',
        line: stale,
        body: {
          ar: 'غيّرت الاسم فوق، بس `d` باقي هنا، والكود كذا ما يشتغل.',
          en: 'You renamed it above, but `d` is still used here, so the code breaks.',
        },
      });
    }
  }

  const log = at(/\bconsole\.\w+\s*\(/);
  if (log) {
    comments.push({
      path: 'about.js',
      line: log,
      body: {
        ar: 'شيل `console.log`. ما نرفع أوامر التجربة للموقع، وهي سبب فشل الـ CI.',
        en: 'Remove the `console.log`. Debug output doesn’t ship, and it’s why CI is failing.',
      },
    });
  }
  return comments.sort((a, b) => a.line - b.line);
}

/** The pull request the level is about: the latest one into main. */
const thePull = (api: LevelApi): PullRequest | undefined => api.world.remote.pulls?.filter((p) => p.base === 'main').at(-1);

const headTree = (api: LevelApi, pr: PullRequest) => pullTrees(api.world.remote, pr).head;

/** Khalid reviews the pull request's latest commit, and says so in the chat. */
function khalidReviews(api: LevelApi, pr: PullRequest, first: boolean): void {
  const js = headTree(api, pr)['about.js'];
  if (js === undefined) {
    api.review('khalid', pr, 'commented', {
      ar: 'هذا الـ PR ما فيه `about.js`. شغلك على `' + BRANCH + '`.',
      en: 'This PR doesn’t have `about.js`. Your work is on `' + BRANCH + '`.',
    });
    api.say('khalid', { ar: 'الـ PR هذا فاضي من شغلك. شغلك على `' + BRANCH + '`.', en: 'That PR has none of your work in it. Your work is on `' + BRANCH + '`.' });
    return;
  }
  const comments = khalidsComments(js);
  if (!comments.length) {
    api.review('khalid', pr, 'approved', { ar: 'تمام. موافق.', en: 'Good. Approved.' });
    api.say('khalid', first ? { ar: 'راجعت الـ PR. نظيف، وافقت. تقدر تدمج.', en: 'Reviewed the PR. Clean, approved. You can merge.' } : { ar: 'شفت التحديث. وافقت، تقدر تدمج.', en: 'Saw the update. Approved, you can merge.' });
    return;
  }
  const two = comments.length > 1;
  api.review(
    'khalid',
    pr,
    'changes_requested',
    two ? { ar: 'قبل الدمج فيه تعديلين.', en: 'Two changes before this can merge.' } : { ar: 'باقي تعديل واحد.', en: 'One change left.' },
    comments,
  );
  if (first) {
    api.say('khalid', {
      ar: 'أنا خالد، أراجع الكود قبل ما يدخل `main`. راجعت الـ PR حقك وطلبت ' + (two ? 'تعديلين' : 'تعديل') + '، التفاصيل في صفحة الطلب.',
      en: 'I’m Khalid. I review code before it goes into `main`. Reviewed your PR: ' + (two ? 'two changes' : 'one change') + ' requested. Details are on the PR page.',
    });
  } else {
    api.say('khalid', two ? { ar: 'شفت التحديث. التعديلين للحين باقيين.', en: 'Saw the update. Both changes are still open.' } : { ar: 'شفت التحديث. باقي تعديل، علّقت عليه.', en: 'Saw the update. One change left; I commented on it.' });
  }
}

/**
 * Level 5 (Junior): the first pull request.
 * The player opens a PR from feature/about, Khalid asks for two changes in about.js, CI fails on a console.log.
 * Pushing fixes to the same branch updates the PR; with Khalid's approval and green CI, the player merges it.
 */
export const level05: Level = {
  id: 5,
  rank: 'junior',
  title: { ar: 'أول طلب دمج', en: 'First pull request' },
  summary: {
    ar: 'افتح طلب دمج (PR) لصفحة «من نحن»، وعدّل اللي يطلبه خالد، وادمجها في main.',
    en: 'Open a pull request (PR) for the About page, fix what Khalid asks for, and merge it into main.',
  },

  setup(player) {
    const remote = bunCafeHistory(player, 5);
    withAboutBranch(remote, player);
    remote.protectedBranches = ['main'];
    remote.pulls = [];
    const local = cloneOnBranch(remote, REPO_DIR, BRANCH);
    local.work['.env'] = ENV_FILE;
    return { remote, local };
  },

  intro(api) {
    api.say('system', { ar: 'اليوم الثاني لك Junior', en: 'Your second day as a Junior' });
    api.say('abufahd', {
      ar: 'صباح الخير يا ' + api.player + '. أمس رفعت `' + BRANCH + '`، وبعدها أضفت `about.js` يكتب إذا المقهى مفتوح. الحين نوصل الشغل لـ `main`.',
      en: 'Morning, ' + api.player + '. Yesterday you pushed `' + BRANCH + '`, then added `about.js` to show whether the café is open. Now let’s get it into `main`.',
    });
    api.say('abufahd', {
      ar:
        'الطريق لـ `main` واحد: طلب دمج (PR). افتحه من تبويب «طلبات الدمج»، وخالد بيراجعه. ' +
        'وعندنا فحص آلي (CI) يشتغل على كل PR، ولو طلع أحمر ما ينفع الدمج.',
      en:
        'There’s one way into `main`: a pull request (PR). Open one from the “Pull requests” tab, and Khalid will review it. ' +
        'We also have an automatic check (CI) on every PR, and while it’s red the PR can’t merge.',
    });
  },

  objectives: [
    {
      text: { ar: 'افتح طلب دمج (PR) من `' + BRANCH + '` إلى `main`', en: 'Open a pull request (PR) from `' + BRANCH + '` into `main`' },
      done: (api) => !!thePull(api),
    },
    {
      text: { ar: 'خلّ فحص الـ CI يطلع أخضر', en: 'Get the CI check to pass' },
      done: (api) => {
        const pr = thePull(api);
        return !!pr && runChecks(headTree(api, pr)).every((c) => c.ok);
      },
    },
    {
      text: { ar: 'خذ موافقة خالد: عدّل ملاحظاته وارفعها بـ `git push` على نفس الفرع', en: 'Get Khalid’s approval: fix his comments and `git push` to the same branch' },
      done: (api) => {
        const pr = thePull(api);
        return !!pr && reviewDecision(pr) === 'approved';
      },
    },
    {
      text: { ar: 'ادمج الـ PR في `main`', en: 'Merge the PR into `main`' },
      done: (api) => thePull(api)?.state === 'merged',
    },
  ],

  hints: [
    {
      ar: 'افتح تبويب «طلبات الدمج» وافتح PR من فرعك. بعدها اقرأ تعليقات خالد، عدّل `about.js`، وارفع على نفس الفرع.',
      en: 'Go to the “Pull requests” tab and open a PR from your branch. Then read Khalid’s comments, fix `about.js`, and push to the same branch.',
    },
    {
      ar:
        'في `about.js`: غيّر `d` إلى `hour` في كل مكان، واحذف سطر `console.log`. بعدها `git add about.js` و `git commit -m "..."` و `git push`. ' +
        'ما تحتاج فرع جديد: الـ push على `' + BRANCH + '` يحدّث نفس الـ PR.',
      en:
        'In `about.js`, rename `d` to `hour` everywhere and delete the `console.log` line. Then `git add about.js`, `git commit -m "..."` and `git push`. ' +
        'No new branch needed: a push to `' + BRANCH + '` updates the same PR.',
    },
    {
      ar:
        'من «طلبات الدمج»: «افتح طلب دمج» ثم «أنشئ طلب الدمج». في `about.js` خلّ `const hour = new Date().getHours();` و `const open = hour >= 7 && hour < 23;` واحذف `console.log`. ' +
        'بعدها `git add about.js` · `git commit -m "Rename hour variable and remove console.log"` · `git push`، وآخر شي «ادمج الطلب» ثم «تأكيد الدمج».',
      en:
        'In “Pull requests”: “Compare & pull request”, then “Create pull request”. In `about.js`, make it `const hour = new Date().getHours();` and `const open = hour >= 7 && hour < 23;`, and delete the `console.log` line. ' +
        'Then `git add about.js` · `git commit -m "Rename hour variable and remove console.log"` · `git push`. Last, “Merge pull request”, then “Confirm merge”.',
    },
  ],

  help: [
    ['git status', { ar: 'وش تغيّر، وأنت على أي فرع', en: 'what changed, and which branch you’re on' }],
    ['git diff', { ar: 'وش عدّلت في الملفات', en: 'what you changed in the files' }],
    ['git add <file>', { ar: 'يجهّز الملف للـ commit', en: 'stages the file for a commit' }],
    ['git commit -m "..."', { ar: 'يسجّل التعديلات برسالة', en: 'records the staged changes with a message' }],
    ['git push', { ar: 'يرفع الـ commits الجديدة لنفس الفرع، والـ PR يتحدّث', en: 'sends new commits to the same branch, and the PR updates' }],
    ['git log --oneline --graph', { ar: 'التاريخ مع الفروع والدمج', en: 'the history, with branches and merges' }],
    ['git switch main', { ar: 'ينقلك لفرع `main`', en: 'moves you to `main`' }],
    ['git pull', { ar: 'يجيب commits الفريق الجديدة لفرعك', en: 'brings the team’s new commits to your branch' }],
  ],

  onPullOpened(api, pr) {
    khalidReviews(api, pr, true);
  },

  onPush(api, pushed, branch) {
    const pr = thePull(api);
    if (pr?.state === 'open' && branch !== pr.head) {
      api.say('khalid', {
        ar: 'ما يحتاج فرع جديد. ارفع على `' + pr.head + '` نفسه، والـ PR يتحدّث لحاله.',
        en: 'No need for a new branch. Push to `' + pr.head + '` itself and the PR updates on its own.',
      });
      return 'handled';
    }
    // On this team the reviewer, not the lead, calls out a weak commit message.
    const weak = pushed.find((c) => isWeakMessage(c.message));
    if (weak) {
      const m = weak.message.split('\n')[0];
      api.rep(-5, { ar: 'رسالة commit غير واضحة', en: 'Unclear commit message' });
      api.say('khalid', {
        ar: 'رسالة الـ commit `' + m + '` ما تقول وش تغيّر. اكتبها بحيث أفهمها من الـ log بدون ما أفتح الكود.',
        en: 'The commit message `' + m + '` doesn’t say what changed. Write it so I can understand it from the log without opening the code.',
      });
    }
    if (pr?.state === 'open' && branch === pr.head) khalidReviews(api, pr, false);
    return weak ? 'handled' : undefined;
  },

  onComplete(api) {
    api.say('abufahd', {
      ar: 'مبروك! أول شغل لك دخل `main` بعد مراجعة، وصفحة «من نحن» صارت في الموقع.',
      en: 'Congratulations! Your first work went into `main` after a review, and the About page is live.',
    });
    api.say('abufahd', {
      ar: 'بس جهازك للحين ما يعرف بالدمج، و `main` عندك قديم. تجيبه بـ `git switch main` ثم `git pull`.',
      en: 'Your machine doesn’t know about the merge yet, so your `main` is behind. Bring it up to date with `git switch main`, then `git pull`.',
    });
  },

  solution: () => [
    { openPull: BRANCH, title: 'Add the About page' },
    { write: 'about.js', content: ABOUT_JS_FIXED },
    'git add about.js',
    'git commit -m "Rename hour variable and remove console.log"',
    'git push',
    { merge: 1 },
  ],
};
