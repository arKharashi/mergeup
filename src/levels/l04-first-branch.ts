import { cloneRepo, headBranch, type LocalRepo, type Tree } from '../engine';
import type { Level, LevelApi } from '../game/level';
import { ABOUT_HTML, ENV_FILE, REPO_DIR, bunCafeHistory } from './fixtures';

const hasAbout = (t: Tree | undefined): boolean => !!t?.['about.html']?.trim();

const isFeature = (b: string): boolean => b.startsWith('feature/');

/** The name to suggest for a branch that doesn't follow the convention: `about` and `feature` become `feature/about`. */
const featureName = (b: string): string => {
  const last = b.split('/').pop();
  return 'feature/' + (last && last !== 'feature' ? last : 'about');
};

/** Local feature/ branches whose last commit has the About page. */
const featuresWithAbout = (L: LocalRepo): string[] =>
  Object.keys(L.branches).filter((b) => isFeature(b) && hasAbout(L.commits[L.branches[b]!]?.tree));

/** The local feature branch that is on the team's repo, About page included, and tracks it there. */
function pushedBranch(api: LevelApi): string | null {
  const L = api.world.local;
  if (!L) return null;
  const r = api.world.remote;
  return featuresWithAbout(L).find((b) => isFeature(L.upstream[b] ?? '') && r.branches[L.upstream[b]!] === L.branches[b]) ?? null;
}

/**
 * Level 4 (Junior): the first branch.
 * The team protected `main` overnight. The About page is drafted on the player's machine;
 * it has to reach the team on a feature/ branch, pushed with -u.
 */
export const level04: Level = {
  id: 4,
  rank: 'junior',
  title: { ar: 'أول فرع', en: 'First branch' },
  summary: {
    ar: 'أول مهمة لك كـ Junior: توصّل صفحة «من نحن» للفريق، في فرع خاص فيك.',
    en: 'Your first task as a Junior: get the About page to the team, on a branch of your own.',
  },

  setup(player) {
    const remote = bunCafeHistory(player, 4);
    remote.protectedBranches = ['main'];
    const local = cloneRepo(remote, REPO_DIR);
    Object.assign(local.work, { 'about.html': ABOUT_HTML, '.env': ENV_FILE });
    return { remote, local, data: { base: remote.branches.main, toldAboutMain: false } };
  },

  intro(api) {
    api.say('system', { ar: 'أول يوم لك Junior', en: 'Your first day as a Junior' });
    api.say('abufahd', {
      ar: 'مبروك الترقية يا ' + api.player + '! صرت Junior، ومن اليوم تشتغل على المشروع مثل باقي الفريق.',
      en: 'Congratulations on the promotion, ' + api.player + '! You’re a Junior now, and from today you work on the project like the rest of the team.',
    });
    api.say('abufahd', {
      ar: 'أمس كتبت صفحة «من نحن» في `about.html`، وهي للحين على جهازك بس. وصّلها للفريق عشان نراجعها. أوامر اليوم الجديدة تلقاها لو كتبت `help` في التيرمينال.',
      en: 'Yesterday you wrote the About page in `about.html`, and it’s still only on your machine. Get it to the team so we can review it. Type `help` in the terminal for today’s new commands.',
    });
  },

  objectives: [
    {
      text: { ar: 'سوِّ فرع بـ `git switch -c`، اسمه يبدأ بـ `feature/` مثل `feature/about`', en: 'Make a branch with `git switch -c`, named like `feature/about`' },
      done: (api) => !!api.world.local && Object.keys(api.world.local.branches).some(isFeature),
    },
    {
      text: { ar: 'سجّل `about.html` في commit على الفرع (`git add` ثم `git commit`)', en: 'Commit `about.html` on that branch (`git add`, then `git commit`)' },
      done: (api) => !!api.world.local && featuresWithAbout(api.world.local).length > 0,
    },
    {
      text: { ar: 'ارفع الفرع للفريق واربطه بنسخته عندهم: `git push -u origin <branch>`', en: 'Push the branch and link it to the team’s copy: `git push -u origin <branch>`' },
      done: (api) => pushedBranch(api) !== null,
    },
    {
      text: { ar: 'شغلك يوصل للفريق و `main` حقهم ما يتغيّر', en: 'Your work reaches the team and their `main` stays as it was' },
      done: (api) => {
        const r = api.world.remote;
        return r.branches.main === api.data.base && Object.keys(r.branches).some((b) => b !== 'main' && hasAbout(r.commits[r.branches[b]!]?.tree));
      },
    },
  ],

  hints: [
    {
      ar: 'من اليوم كل شغل يصير في فرع خاص فيك، مو على `main`. سوِّ فرع، سجّل فيه، وارفع الفرع نفسه.',
      en: 'From today, all work happens on a branch of your own, not on `main`. Make a branch, commit on it, and push that branch.',
    },
    {
      ar: '`git switch -c feature/about` يسوي الفرع وينقلك له. بعدها `git add` و `git commit` مثل العادة، وأول رفع للفرع يكون بـ `git push -u origin feature/about`.',
      en: '`git switch -c feature/about` makes the branch and moves you onto it. Then `git add` and `git commit` as usual. The first push of the branch is `git push -u origin feature/about`.',
    },
    {
      ar:
        '`git switch -c feature/about` · `git add about.html` · `git commit -m "Add about page"` · `git push -u origin feature/about`. ' +
        'لو سجّلت على `main` من قبل، تخطَّ `add` و `commit`: الفرع الجديد ياخذ الـ commit معه.',
      en:
        '`git switch -c feature/about` · `git add about.html` · `git commit -m "Add about page"` · `git push -u origin feature/about`. ' +
        'If you already committed on `main`, skip `add` and `commit`: the new branch takes the commit with it.',
    },
  ],

  help: [
    ['git status', { ar: 'وش تغيّر، وأنت على أي فرع', en: 'what changed, and which branch you’re on' }],
    ['git branch', { ar: 'يعرض الفروع، والنجمة على فرعك الحالي', en: 'lists the branches, with a star on yours' }],
    ['git switch -c <branch>', { ar: 'يسوي فرع جديد وينقلك له', en: 'makes a new branch and moves you onto it' }],
    ['git switch <branch>', { ar: 'ينقلك لفرع موجود', en: 'moves you to a branch that exists' }],
    ['git add <file>', { ar: 'يجهّز الملف للـ commit', en: 'stages the file for a commit' }],
    ['git commit -m "..."', { ar: 'يسجّل التعديلات برسالة', en: 'records the staged changes with a message' }],
    ['git push -u origin <branch>', { ar: 'يرفع الفرع أول مرة ويربطه بنسخة الفريق', en: 'pushes the branch the first time and links it to the team’s copy' }],
    ['git branch -m <old> <new>', { ar: 'يغيّر اسم فرع', en: 'renames a branch' }],
  ],

  // Most players commit on main and push, like they did as Interns. The protection catches it.
  onPushRejected(api, branch, reason) {
    if (reason !== 'protected' || api.data.toldAboutMain) return;
    api.data.toldAboutMain = true;
    api.say('abufahd', {
      ar:
        'الرفض هذا مقصود، لا تشيل هم. أمس فعّلنا حماية على `' + branch + '`: هو النسخة اللي تنزل للموقع، ' +
        'ولو كل واحد يرفع عليه مباشرة يكفي خطأ واحد ويطيح الموقع على الكل.',
      en:
        'That rejection is on purpose, don’t worry. Yesterday we turned on protection for `' + branch + '`. It’s the version that goes live on the site, ' +
        'and if everyone pushed straight to it, one mistake would take the site down for everyone.',
    });
    api.say('abufahd', {
      ar:
        'كل شغل جديد يبدأ في فرع خاص فيك، واسمه يبدأ بـ `feature/`، مثل `feature/about`. والـ commit حقك ما ضاع: ' +
        'لو سويت الفرع وأنت واقف مكانك، ينتقل معك. بعدها ارفع الفرع.',
      en:
        'All new work starts on a branch of your own, with a name that starts with `feature/`, like `feature/about`. And your commit isn’t lost: ' +
        'make the branch right where you are and it comes along. Then push the branch.',
    });
  },

  // Catch a badly named branch at the first commit on it, before pushing it costs reputation.
  onCommit(api) {
    const branch = headBranch(api.world.local!);
    if (!branch || branch === 'main' || isFeature(branch)) return;
    api.tip({
      ar: 'اسم فرعك `' + branch + '` ما يبدأ بـ `feature/`. غيّر اسمه قبل ما ترفعه: `git branch -m ' + featureName(branch) + '`',
      en: 'Your branch `' + branch + '` doesn’t start with `feature/`. Rename it before you push: `git branch -m ' + featureName(branch) + '`',
    });
  },

  onPush(api, _pushed, branch) {
    const L = api.world.local!;
    const r = api.world.remote;
    if (!isFeature(branch)) {
      const name = featureName(branch);
      api.rep(-2, { ar: 'اسم الفرع ما يمشي على اتفاق الفريق', en: 'Branch name doesn’t follow the team’s convention' });
      api.say('abufahd', {
        ar:
          'وصل فرعك `' + branch + '`، بس عندنا اتفاق: فروع الشغل الجديد تبدأ بـ `feature/`، عشان أي أحد يعرف من الاسم وش فيها. ' +
          'غيّر اسمه بـ `git branch -m ' + branch + ' ' + name + '` وارفعه من جديد.',
        en:
          'Your branch `' + branch + '` arrived, but we have a convention: branches for new work start with `feature/`, so anyone can tell from the name what’s in them. ' +
          'Rename it with `git branch -m ' + branch + ' ' + name + '` and push it again.',
      });
      return;
    }
    if (!hasAbout(r.commits[r.branches[branch]!]?.tree)) {
      api.tip({
        ar: 'الفرع وصل للفريق، بس ما فيه `about.html`. سجّله في commit على الفرع وارفع مرة ثانية.',
        en: 'The branch reached the team, but `about.html` isn’t on it. Commit it on the branch and push again.',
      });
    } else if (!Object.values(L.upstream).includes(branch)) {
      api.tip({
        ar: 'الفرع وصل للفريق، بس فرعك ما انربط بنسخته عندهم. أعد الأمر مع `-u`: `git push -u origin ' + branch + '`، وبعدها يكفيك `git push` لحاله.',
        en: 'The branch reached the team, but yours isn’t linked to their copy. Run it again with `-u`: `git push -u origin ' + branch + '`. After that, `git push` on its own is enough.',
      });
    }
  },

  // Players who made the branch first never saw the rejection, so they hear the why here.
  onComplete(api) {
    const branch = pushedBranch(api) ?? 'feature/about';
    if (!api.data.toldAboutMain) {
      api.say('abufahd', {
        ar:
          'ليش فرع؟ `main` هو النسخة اللي تنزل للموقع، وكل الفريق يعتمد عليه. لو كل واحد يرفع عليه مباشرة، أي غلطة توصل للموقع على طول. ' +
          'عشان كذا أمس فعّلنا عليه حماية، وما أحد يرفع عليه مباشرة.',
        en:
          'Why a branch? `main` is the version that goes live on the site, and the whole team depends on it. If everyone pushed straight to it, any mistake would go live right away. ' +
          'That’s why we protected it yesterday: nobody pushes to it directly.',
      });
    }
    api.say('abufahd', {
      ar:
        'صفحتك الحين عند الفريق في فرع `' + branch + '`، جنب `main` مو داخله، والموقع للحين يشتغل بدونها. ' +
        'بكرة تفتح طلب دمج (PR) من فرعك إلى `main`، وخالد يراجعه. ولما يوافق، تندمج صفحتك في `main` وتنزل للموقع.',
      en:
        'Your page is now on the team’s repo, on the `' + branch + '` branch: next to `main`, not inside it, and the site still runs without it. ' +
        'Tomorrow you’ll open a pull request (PR) from your branch into `main`, and Khalid will review it. Once he approves, your page is merged into `main` and goes live.',
    });
  },

  solution: () => ['git switch -c feature/about', 'git add about.html', 'git commit -m "Add about page"', 'git push -u origin feature/about'],
};
