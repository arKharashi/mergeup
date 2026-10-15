import { headTree } from '../engine';
import type { Level } from '../game/level';
import { REPO_URL, bunCafeHistory, hasPlayerLine, newLines } from './fixtures';

/**
 * Level 1 (Intern): the first day.
 * Clone the team's project, add your name to the README, commit, push.
 * The only level where pushing straight to main is fine.
 */
export const level01: Level = {
  id: 1,
  rank: 'intern',
  title: { ar: 'أول يوم', en: 'First day' },
  summary: {
    ar: 'حياك في الفريق. خذ نسخة من المشروع وأضف اسمك لقائمة الفريق.',
    en: 'Welcome to the team. Get a copy of the project and add your name to the team list.',
  },

  setup: () => ({ remote: bunCafeHistory(null) }),

  intro(api) {
    api.say('system', { ar: 'اليوم الأول لك في فريق بُن', en: 'Your first day on the Bun team' });
    api.say('abufahd', {
      ar: 'هلا والله يا ' + api.player + '، حياك في فريق بُن! أنا أبو فهد، قائد الفريق.',
      en: 'Hey ' + api.player + ', welcome to the Bun team! I’m Abu Fahd, the team lead.',
    });
    api.say(
      'abufahd',
      {
        ar: 'كل شغلنا على مشروع واحد اسمه bun-cafe، وهو موقع المقهى. أول شي خذ نسخة منه على جهازك بـ `git clone`. هذا الرابط:',
        en: 'All our work is on one project, bun-cafe: the café’s website. First, get a copy on your machine with `git clone`. Here’s the link:',
      },
      { url: REPO_URL },
    );
    api.say('abufahd', {
      ar: 'بعدها افتح `README.md` وأضف اسمك تحت قسم الفريق، وارفع التعديل للفريق. لو احتجت الأوامر اكتب `help` في التيرمينال.',
      en: 'Then open `README.md`, add your name under the team section, and push the change to the team. If you need the commands, type `help` in the terminal.',
    });
  },

  objectives: [
    { text: { ar: 'استنسخ المشروع بـ `git clone`', en: 'Clone the project with `git clone`' }, done: (api) => !!api.world.local },
    {
      text: (api) => ({
        ar: 'أضف اسمك (' + api.player + ') تحت «الفريق» في `README.md`',
        en: 'Add your name (' + api.player + ') under «الفريق» (the team) in `README.md`',
      }),
      done: (api) => hasPlayerLine(api.world.local?.work['README.md'], api.player),
    },
    {
      text: { ar: 'جهّز التعديل بـ `git add`', en: 'Stage the change with `git add`' },
      done: (api) => hasPlayerLine(api.world.local?.index['README.md'], api.player),
    },
    {
      text: { ar: 'سجّله بـ `git commit` مع رسالة واضحة', en: 'Commit it with `git commit` and a clear message' },
      done: (api) => !!api.world.local && hasPlayerLine(headTree(api.world.local)['README.md'], api.player),
    },
    {
      text: { ar: 'ارفعه للفريق بـ `git push`', en: 'Push it to the team with `git push`' },
      done: (api) => {
        const r = api.world.remote;
        return hasPlayerLine(r.commits[r.branches.main!]?.tree['README.md'], api.player);
      },
    },
  ],

  hints: [
    {
      ar: 'تحتاج أول شي نسخة من المشروع على جهازك. الرابط في رسالة أبو فهد.',
      en: 'First you need a copy of the project on your machine. The link is in Abu Fahd’s message.',
    },
    {
      ar: 'الترتيب: `git clone` ثم `cd bun-cafe`. عدّل `README.md` من لوحة الملفات، وبعدها `git add` ثم `git commit -m` ثم `git push`.',
      en: 'The order: `git clone`, then `cd bun-cafe`. Edit `README.md` in the Files panel, then `git add`, `git commit -m` and `git push`.',
    },
    (api) => ({
      ar:
        '`git clone ' + REPO_URL + '` ثم `cd bun-cafe`. أضف السطر `- ' + api.player + ' — متدرب` في آخر README.md واحفظ. ' +
        'بعدها: `git add README.md` و `git commit -m "Add ' + api.player + ' to the team list"` و `git push`',
      en:
        '`git clone ' + REPO_URL + '`, then `cd bun-cafe`. Add the line `- ' + api.player + ' — Intern` at the end of README.md and save. ' +
        'Then: `git add README.md`, `git commit -m "Add ' + api.player + ' to the team list"` and `git push`',
    }),
  ],

  help: [
    ['git clone <url>', { ar: 'ينسخ المشروع من الفريق لجهازك', en: 'copies the team’s project to your machine' }],
    ['cd bun-cafe', { ar: 'يدخلك مجلد المشروع', en: 'takes you into the project folder' }],
    ['git status', { ar: 'يوضح وش تغيّر ووش جاهز للتسجيل', en: 'shows what changed and what is staged' }],
    ['git add <file>', { ar: 'يجهّز الملف للـ commit', en: 'stages the file for a commit' }],
    ['git commit -m "..."', { ar: 'يسجّل التعديلات برسالة', en: 'records the staged changes with a message' }],
    ['git push', { ar: 'يرفع الـ commits للفريق', en: 'sends your commits to the team' }],
  ],

  // A line was added, but without the name the player signed up with ("عبدالرحمن" vs "Abdulrahman").
  onPush(api) {
    const r = api.world.remote;
    const readme = r.commits[r.branches.main!]?.tree['README.md'];
    if (newLines(readme).length && !hasPlayerLine(readme, api.player)) {
      api.say('abufahd', {
        ar:
          'وصلني تعديلك، بس ما لقيت اسمك في السطر الجديد. اسمك عندنا «' + api.player + '». ' +
          'عدّل السطر في `README.md` واكتبه مثل ما هو، وبعدها سجّل التعديل وارفعه من جديد.',
        en:
          'I got your change, but I can’t find your name in the new line. We have you down as «' + api.player + '». ' +
          'Fix the line in `README.md` so it says that, then commit and push again.',
      });
    }
  },

  onComplete(api) {
    api.say('abufahd', {
      ar: 'وصلني تعديلك وشفت اسمك في القائمة. رسمياً صرت من الفريق يا ' + api.player + '!',
      en: 'Got your change, and I see your name on the list. You’re officially on the team, ' + api.player + '!',
    });
  },

  solution: (name) => [
    'git clone ' + REPO_URL,
    'cd bun-cafe',
    'echo "- ' + name + ' — متدرب" >> README.md',
    'git add README.md',
    'git commit -m "Add ' + name + ' to the team list"',
    'git push',
  ],
};
