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
  title: 'ترتيب الشغل',
  summary: 'عندك ثلاث تعديلات مختلفة في ثلاث ملفات، وملف أسرار. كل تعديل في commit لحاله، والأسرار ما تنرفع.',

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
    api.say('system', 'اليوم الثالث');
    api.say('abufahd', 'أمس سويت ثلاث مهام: أضفت شاي كرك للمنيو، وكبّرت خط المنيو، ونزّلت سعر السبانش لاتيه. كلها للحين على جهازك بس.');
    api.say('abufahd', 'أبي كل مهمة في commit لحالها. لو طلع خطأ في وحدة، نقدر نرجعها بدون ما نخرب الباقي.');
    api.say('abufahd', 'وانتبه: ملف `.env` فيه كلمة سر قاعدة البيانات. هذا ما ينرفع أبداً. حطه في `.gitignore` وسجّل الـ .gitignore بعد.', {
      alert: true,
    });
  },

  objectives: [
    {
      text: 'أضف `.env` في ملف `.gitignore` وسجّله في commit',
      done: (api) => !!api.world.local && isIgnored('.env', headTree(api.world.local)['.gitignore']),
    },
    { text: 'شاي الكرك (`menu.html`) في commit لحاله', done: (api) => committedAlone(api, 'menu.html') },
    { text: 'حجم الخط (`style.css`) في commit لحاله', done: (api) => committedAlone(api, 'style.css') },
    { text: 'سعر السبانش (`prices.json`) في commit لحاله', done: (api) => committedAlone(api, 'prices.json') },
    {
      text: 'ارفع الشغل للفريق، و `.env` ما ينرفع',
      done: (api) => {
        const L = api.world.local;
        const r = api.world.remote;
        if (!L || r.branches.main !== L.branches.main) return false;
        return TASKS.every((f) => committedAlone(api, f)) && isIgnored('.env', r.commits[r.branches.main!]!.tree['.gitignore']);
      },
    },
  ],

  hints: [
    'ابدأ بـ `git status` تشوف كل اللي تغيّر. وتذكّر: `git add .` يضيف كل شي مرة وحدة، وهذا اللي ما نبيه هنا.',
    'سوِّ `.gitignore` فيه سطر `.env`، بعدها لكل ملف: `git add <file>` ثم `git commit -m` مباشرة، قبل ما تضيف اللي بعده.',
    '`echo ".env" > .gitignore` · `git add .gitignore` · `git commit -m "Ignore local env file"` · ' +
      '`git add menu.html` · `git commit -m "Add karak tea to the menu"` · `git add style.css` · ' +
      '`git commit -m "Increase menu font size"` · `git add prices.json` · `git commit -m "Lower Spanish latte price to 17"` · `git push`',
  ],

  help: [
    ['git status', 'وش تغيّر ووش جاهز'],
    ['git add <file>', 'جهّز ملف واحد بس'],
    ['git restore --staged <file>', 'شيل الملف من التجهيز'],
    ['git diff', 'وش تغيّر في الملفات'],
    ['git commit -m "..."', 'سجّل'],
    ['git reset HEAD~1', 'تراجع عن آخر commit (قبل الـ push)'],
    ['git push', 'ارفع'],
  ],

  onCommit(api, commit) {
    const L = api.world.local!;
    if ('.env' in commit.tree) {
      api.tip('انتبه: ملف `.env` صار داخل هذا الـ commit. لسا ما رفعته، فتقدر تتراجع: `git reset HEAD~1` ثم سوِّ `.gitignore` قبل لا تعيد.');
    }
    const t = tasksIn(commit, L);
    if (t.length > 1) api.tip('هذا الـ commit فيه ' + t.length + ' مهام مختلفة (' + t.join('، ') + '). تقدر تفكه قبل الرفع: `git reset HEAD~1`');
  },

  onPush(api, pushed) {
    if (pushed.some((c) => '.env' in c.tree)) {
      api.rep(-15, 'رفعت كلمة سر للمشروع');
      api.say(
        'abufahd',
        'وقّف! ملف `.env` وصل للمشروع وفيه كلمة سر قاعدة البيانات. أي أحد عنده وصول للمشروع صار يشوفها. بنغيّر كلمة السر الحين، بس لازم ما تتكرر.',
        { alert: true },
      );
      api.fail('ملف `.env` انرفع للمشروع، وكلمة السر صارت مكشوفة لكل الفريق. حطه في `.gitignore` قبل أي `git add`.');
      return 'handled';
    }
    const L = api.world.local!;
    const mixed = pushed.find((c) => tasksIn(c, L).length > 1);
    if (mixed) {
      api.rep(-5, 'خلطت أكثر من مهمة في commit واحد');
      api.say(
        'abufahd',
        'وصل الشغل، بس الـ commit `' + mixed.message.split('\n')[0] + '` فيه أكثر من مهمة. لو طلع خطأ في وحدة منها ما نقدر نرجعها لحالها.',
      );
      api.fail('رفعت commit فيه أكثر من مهمة. كل مهمة لازم تكون في commit لحالها، عشان الفريق يقدر يراجعها أو يتراجع عنها بسهولة.');
      return 'handled';
    }
  },

  onComplete(api) {
    api.say('abufahd', 'هذا الشغل المرتب اللي أبيه. ثلاث commits واضحة، وكلمة السر في مكانها.');
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
