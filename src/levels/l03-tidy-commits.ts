import { cloneRepo, commitsSince, headId, headTree, isIgnored, treeDiff, type Commit, type LocalRepo } from '../engine';
import type { Level, LevelApi } from '../game/level';
import { ENV_FILE, MENU_WITH_KARAK, PRICES_LATTE_17, REPO_DIR, STYLE_FONT_16, bunCafeHistory } from './fixtures';

/** The three separate tasks the player did yesterday. Each must land in its own commit. */
const TASKS = ['menu.html', 'style.css', 'prices.json'];

const tasksIn = (c: Commit, L: LocalRepo): string[] => {
  const parent = c.parents[0] ? L.commits[c.parents[0]]!.tree : {};
  return treeDiff(parent, c.tree).filter((p) => TASKS.includes(p));
};

/** Has `file`'s change been committed, in a commit that touches no other task? */
function committedAlone(api: LevelApi, file: string): boolean {
  const L = api.world.local;
  const base = api.data.base as string;
  if (!L || headTree(L)[file] === L.commits[base]!.tree[file]) return false;
  return commitsSince(L.commits, headId(L), base).some((c) => {
    const t = tasksIn(c, L);
    return t.length === 1 && t[0] === file;
  });
}

/**
 * Level 3 (Intern): one task per commit, and secrets never leave your machine.
 * Three unrelated edits plus a .env file with a password are waiting in the working tree.
 */
export const level03: Level = {
  id: 3,
  rank: 'intern',
  title: { ar: 'ترتيب الشغل', en: 'Tidy commits' },
  summary: {
    ar: 'عندك ثلاث تعديلات مختلفة في ثلاث ملفات، وملف أسرار. كل تعديل في commit لحاله، والأسرار ما تنرفع.',
    en: 'You have three unrelated changes in three files, plus a secrets file. Each change gets its own commit, and secrets never get pushed.',
  },

  setup(player) {
    const remote = bunCafeHistory(player);
    const local = cloneRepo(remote, REPO_DIR);
    Object.assign(local.work, {
      'menu.html': MENU_WITH_KARAK,
      'style.css': STYLE_FONT_16,
      'prices.json': PRICES_LATTE_17,
      '.env': ENV_FILE,
    });
    return { remote, local, data: { base: remote.branches.main } };
  },

  intro(api) {
    api.say('system', { ar: 'اليوم الثالث', en: 'Day three' });
    api.say('abufahd', {
      ar: 'أمس سويت ثلاث مهام: أضفت شاي كرك للمنيو، وكبّرت خط المنيو، ونزّلت سعر السبانش لاتيه. كلها للحين على جهازك بس.',
      en: 'Yesterday you did three tasks: added karak tea to the menu, made the menu font bigger, and lowered the Spanish latte price. All of it is still only on your machine.',
    });
    api.say('abufahd', {
      ar: 'أبي كل مهمة في commit لحالها. لو طلع خطأ في وحدة، نقدر نرجعها بدون ما نخرب الباقي.',
      en: 'I want each task in its own commit. If one of them turns out to be wrong, we can undo it without breaking the rest.',
    });
    api.say(
      'abufahd',
      {
        ar: 'وانتبه: ملف `.env` فيه كلمة سر قاعدة البيانات. هذا ما ينرفع أبداً. حطه في `.gitignore` وسجّل الـ .gitignore بعد.',
        en: 'And careful: `.env` holds the database password. It never gets pushed. Put it in `.gitignore`, and commit the .gitignore too.',
      },
      { alert: true },
    );
  },

  objectives: [
    {
      text: { ar: 'أضف `.env` في ملف `.gitignore` وسجّله في commit', en: 'Add `.env` to `.gitignore` and commit it' },
      done: (api) => !!api.world.local && isIgnored('.env', headTree(api.world.local)['.gitignore']),
    },
    {
      text: { ar: 'شاي الكرك (`menu.html`) في commit لحاله', en: 'Karak tea (`menu.html`) in a commit of its own' },
      done: (api) => committedAlone(api, 'menu.html'),
    },
    {
      text: { ar: 'حجم الخط (`style.css`) في commit لحاله', en: 'The font size (`style.css`) in a commit of its own' },
      done: (api) => committedAlone(api, 'style.css'),
    },
    {
      text: { ar: 'سعر السبانش (`prices.json`) في commit لحاله', en: 'The Spanish latte price (`prices.json`) in a commit of its own' },
      done: (api) => committedAlone(api, 'prices.json'),
    },
    {
      text: { ar: 'ارفع الشغل للفريق، و `.env` ما ينرفع', en: 'Push the work to the team, without `.env`' },
      done: (api) => {
        const L = api.world.local;
        const r = api.world.remote;
        if (!L || r.branches.main !== L.branches.main) return false;
        return TASKS.every((f) => committedAlone(api, f)) && isIgnored('.env', r.commits[r.branches.main!]!.tree['.gitignore']);
      },
    },
  ],

  hints: [
    {
      ar: 'ابدأ بـ `git status` تشوف كل اللي تغيّر. وتذكّر: `git add .` يضيف كل شي مرة وحدة، وهذا اللي ما نبيه هنا.',
      en: 'Start with `git status` to see everything that changed. And remember: `git add .` stages everything at once, which is exactly what we don’t want here.',
    },
    {
      ar: 'سوِّ `.gitignore` فيه سطر `.env`، بعدها لكل ملف: `git add <file>` ثم `git commit -m` مباشرة، قبل ما تضيف اللي بعده.',
      en: 'Make a `.gitignore` with a `.env` line. Then for each file: `git add <file>`, then `git commit -m` right away, before you stage the next one.',
    },
    {
      ar:
        '`echo ".env" > .gitignore` · `git add .gitignore` · `git commit -m "Ignore local env file"` · ' +
        '`git add menu.html` · `git commit -m "Add karak tea to the menu"` · `git add style.css` · ' +
        '`git commit -m "Increase menu font size"` · `git add prices.json` · `git commit -m "Lower Spanish latte price to 17"` · `git push`',
      en:
        '`echo ".env" > .gitignore` · `git add .gitignore` · `git commit -m "Ignore local env file"` · ' +
        '`git add menu.html` · `git commit -m "Add karak tea to the menu"` · `git add style.css` · ' +
        '`git commit -m "Increase menu font size"` · `git add prices.json` · `git commit -m "Lower Spanish latte price to 17"` · `git push`',
    },
  ],

  help: [
    ['git status', { ar: 'وش تغيّر ووش جاهز', en: 'what changed and what is staged' }],
    ['git add <file>', { ar: 'جهّز ملف واحد بس', en: 'stage just one file' }],
    ['git restore --staged <file>', { ar: 'شيل الملف من التجهيز', en: 'unstage the file' }],
    ['git diff', { ar: 'وش تغيّر في الملفات', en: 'what changed in the files' }],
    ['git commit -m "..."', { ar: 'سجّل', en: 'commit' }],
    ['git reset HEAD~1', { ar: 'تراجع عن آخر commit (قبل الـ push)', en: 'undo the last commit (before you push)' }],
    ['git push', { ar: 'ارفع', en: 'push' }],
  ],

  onCommit(api, commit) {
    const L = api.world.local!;
    if ('.env' in commit.tree) {
      api.tip({
        ar: 'انتبه: ملف `.env` صار داخل هذا الـ commit. لسا ما رفعته، فتقدر تتراجع: `git reset HEAD~1` ثم سوِّ `.gitignore` قبل لا تعيد.',
        en: 'Careful: `.env` is now in this commit. You haven’t pushed it yet, so you can undo it: `git reset HEAD~1`, then make the `.gitignore` before you try again.',
      });
    }
    const t = tasksIn(commit, L);
    if (t.length > 1) {
      api.tip({
        ar: 'هذا الـ commit فيه ' + t.length + ' مهام مختلفة (' + t.join('، ') + '). تقدر تفكه قبل الرفع: `git reset HEAD~1`',
        en: 'This commit holds ' + t.length + ' different tasks (' + t.join(', ') + '). You can split it before you push: `git reset HEAD~1`',
      });
    }
  },

  onPush(api, pushed) {
    if (pushed.some((c) => '.env' in c.tree)) {
      api.rep(-15, { ar: 'رفعت كلمة سر للمشروع', en: 'Pushed a password to the project' });
      api.say(
        'abufahd',
        {
          ar: 'وقّف! ملف `.env` وصل للمشروع وفيه كلمة سر قاعدة البيانات. أي أحد عنده وصول للمشروع صار يشوفها. بنغيّر كلمة السر الحين، بس لازم ما تتكرر.',
          en: 'Stop! `.env` made it into the project, with the database password in it. Anyone with access to the project can see it now. We’ll change the password right away, but this can’t happen again.',
        },
        { alert: true },
      );
      api.fail({
        ar: 'ملف `.env` انرفع للمشروع، وكلمة السر صارت مكشوفة لكل الفريق. حطه في `.gitignore` قبل أي `git add`.',
        en: '`.env` was pushed to the project, and the password is now exposed to the whole team. Put it in `.gitignore` before any `git add`.',
      });
      return 'handled';
    }
    const L = api.world.local!;
    const mixed = pushed.find((c) => tasksIn(c, L).length > 1);
    if (mixed) {
      const subject = mixed.message.split('\n')[0];
      api.rep(-5, { ar: 'خلطت أكثر من مهمة في commit واحد', en: 'Mixed several tasks in one commit' });
      api.say('abufahd', {
        ar: 'وصل الشغل، بس الـ commit `' + subject + '` فيه أكثر من مهمة. لو طلع خطأ في وحدة منها ما نقدر نرجعها لحالها.',
        en: 'The work arrived, but the commit `' + subject + '` holds more than one task. If one of them is wrong, we can’t undo it on its own.',
      });
      api.fail({
        ar: 'رفعت commit فيه أكثر من مهمة. كل مهمة لازم تكون في commit لحالها، عشان الفريق يقدر يراجعها أو يتراجع عنها بسهولة.',
        en: 'You pushed a commit with more than one task. Each task needs its own commit, so the team can review it or undo it easily.',
      });
      return 'handled';
    }
  },

  onComplete(api) {
    api.say('abufahd', {
      ar: 'هذا الشغل المرتب اللي أبيه. ثلاث commits واضحة، وكلمة السر في مكانها.',
      en: 'That’s the tidy work I want. Three clear commits, and the password stays where it belongs.',
    });
  },

  solution: () => [
    'echo ".env" > .gitignore',
    'git add .gitignore',
    'git commit -m "Ignore local env file"',
    'git add menu.html',
    'git commit -m "Add karak tea to the menu"',
    'git add style.css',
    'git commit -m "Increase menu font size"',
    'git add prices.json',
    'git commit -m "Lower Spanish latte price to 17"',
    'git push',
  ],
};
