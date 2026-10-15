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
  title: 'أول يوم',
  summary: 'حياك في الفريق. خذ نسخة من المشروع وأضف اسمك لقائمة الفريق.',

  setup: () => ({ remote: bunCafeHistory(null) }),

  intro(api) {
    api.say('system', 'اليوم الأول لك في فريق بُن');
    api.say('abufahd', 'هلا والله يا ' + api.player + '، حياك في فريق بُن! أنا أبو فهد، قائد الفريق.');
    api.say('abufahd', 'كل شغلنا على مشروع واحد اسمه bun-cafe، وهو موقع المقهى. أول شي خذ نسخة منه على جهازك بـ `git clone`. هذا الرابط:', {
      url: REPO_URL,
    });
    api.say('abufahd', 'بعدها افتح `README.md` وأضف اسمك تحت قسم الفريق، وارفع التعديل للفريق. لو احتجت الأوامر اكتب `help` في التيرمينال.');
  },

  objectives: [
    { text: 'استنسخ المشروع بـ `git clone`', done: (api) => !!api.world.local },
    {
      text: (api) => 'أضف اسمك (' + api.player + ') تحت «الفريق» في `README.md`',
      done: (api) => hasPlayerLine(api.world.local?.work['README.md'], api.player),
    },
    {
      text: 'جهّز التعديل بـ `git add`',
      done: (api) => hasPlayerLine(api.world.local?.index['README.md'], api.player),
    },
    {
      text: 'سجّله بـ `git commit` مع رسالة واضحة',
      done: (api) => !!api.world.local && hasPlayerLine(headTree(api.world.local)['README.md'], api.player),
    },
    {
      text: 'ارفعه للفريق بـ `git push`',
      done: (api) => {
        const r = api.world.remote;
        return hasPlayerLine(r.commits[r.branches.main!]?.tree['README.md'], api.player);
      },
    },
  ],

  hints: [
    'تحتاج أول شي نسخة من المشروع على جهازك. الرابط في رسالة أبو فهد.',
    'الترتيب: `git clone` ثم `cd bun-cafe`. عدّل `README.md` من لوحة الملفات، وبعدها `git add` ثم `git commit -m` ثم `git push`.',
    (api) =>
      '`git clone ' + REPO_URL + '` ثم `cd bun-cafe`. أضف السطر `- ' + api.player + ' — متدرب` في آخر README.md واحفظ. ' +
      'بعدها: `git add README.md` و `git commit -m "Add ' + api.player + ' to the team list"` و `git push`',
  ],

  help: [
    ['git clone <url>', 'ينسخ المشروع من الفريق لجهازك'],
    ['cd bun-cafe', 'يدخلك مجلد المشروع'],
    ['git status', 'يوضح وش تغيّر ووش جاهز للتسجيل'],
    ['git add <file>', 'يجهّز الملف للـ commit'],
    ['git commit -m "..."', 'يسجّل التعديلات برسالة'],
    ['git push', 'يرفع الـ commits للفريق'],
  ],

  // A line was added, but without the name the player signed up with ("عبدالرحمن" vs "Abdulrahman").
  onPush(api) {
    const r = api.world.remote;
    const readme = r.commits[r.branches.main!]?.tree['README.md'];
    if (newLines(readme).length && !hasPlayerLine(readme, api.player)) {
      api.say(
        'abufahd',
        'وصلني تعديلك، بس ما لقيت اسمك في السطر الجديد. اسمك عندنا «' + api.player + '». ' +
          'عدّل السطر في `README.md` واكتبه مثل ما هو، وبعدها سجّل التعديل وارفعه من جديد.',
      );
    }
  },

  onComplete(api) {
    api.say('abufahd', 'وصلني تعديلك وشفت اسمك في القائمة. رسمياً صرت من الفريق يا ' + api.player + '!');
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
