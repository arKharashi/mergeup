import { cloneRepo } from '../engine';
import type { Level } from '../game/level';
import { REPO_DIR, bunCafeHistory } from './fixtures';

/**
 * Level 2 (Intern): reading the project's history.
 * Abu Fahd asks two questions in the chat; the answers are in git log / git show.
 */
export const level02: Level = {
  id: 2,
  rank: 'intern',
  title: 'تاريخ المشروع',
  summary: 'كل تعديل في المشروع انحفظ: مين سواه، ومتى، ووش غيّر. أبو فهد عنده سؤالين.',

  setup(player) {
    const remote = bunCafeHistory(player);
    return { remote, local: cloneRepo(remote, REPO_DIR) };
  },

  intro(api) {
    api.say('system', 'اليوم الثاني · المشروع عندك جاهز في bun-cafe');
    api.say('abufahd', 'صباح الخير يا ' + api.player + '. اليوم أبيك تتعرف على تاريخ المشروع، لأن نص شغلنا قراءة لشغل غيرنا.');
    api.say('abufahd', 'سؤال أول: ملف الأسعار `prices.json`، مين أضافه للمشروع؟', {
      question: {
        id: 'who-added-prices',
        options: ['أبو فهد', 'سارة', 'خالد', 'نورة'],
        answer: 'خالد',
        right(api) {
          api.say('abufahd', 'صح، خالد أضافه. شفته في الـ log؟ كل سطر في المشروع وراه اسم.');
          api.say('abufahd', 'سؤال ثاني: سارة غيّرت سعر القهوة السعودية قبل كم يوم. كم كان السعر قبل تعديلها؟', {
            question: {
              id: 'old-price',
              options: ['10', '12', '15', '18'],
              answer: '12',
              wrong(api, value) {
                if (value === '15') api.say('abufahd', 'هذا السعر بعد تعديلها. أبي اللي قبله. افتح الـ commit حقها بـ `git show`.');
                else api.say('abufahd', 'قريب، بس لا. `git show` على commit سارة يوريك السطر القديم بالأحمر.');
              },
            },
          });
        },
        wrong(api) {
          api.say('abufahd', 'لا، مو هو. لا تخمّن: `git log -- prices.json` يوريك مين لمس الملف.');
        },
      },
    });
  },

  objectives: [
    { text: 'اعرض تاريخ المشروع بـ `git log`', done: (api) => !!api.ran.log },
    { text: 'جاوب: مين أضاف `prices.json`؟', done: (api) => !!api.answers['who-added-prices'] },
    { text: 'جاوب: كم كان سعر القهوة السعودية قبل آخر تعديل؟', done: (api) => !!api.answers['old-price'] },
  ],

  hints: [
    'كل commit فيه اسم صاحبه. ابدأ بعرض قائمة الـ commits.',
    '`git log -- prices.json` يعرض بس الـ commits اللي لمست الملف. و `git show <hash>` يوريك وش تغيّر بالضبط.',
    '`git log -- prices.json` بيطلع لك commitين. الأقدم (تحت) أضافه خالد. ' +
      'انسخ أول 7 حروف من hash الأحدث (حق سارة) واكتب `git show <hash>`: السطر الأحمر فيه السعر القديم 12، والأخضر الجديد 15.',
  ],

  help: [
    ['git log', 'يعرض كل الـ commits بالتفصيل'],
    ['git log --oneline', 'سطر واحد لكل commit'],
    ['git log -- <file>', 'الـ commits اللي غيّرت ملف معيّن'],
    ['git show <hash>', 'وش تغيّر في commit معيّن'],
    ['git diff <a> <b>', 'الفرق بين نسختين'],
  ],

  onComplete(api) {
    api.say('abufahd', 'ممتاز. اللي يعرف يقرأ التاريخ يعرف يحل نص المشاكل قبل ما يسأل أحد.');
  },

  solution: () => [
    'git log --oneline -- prices.json',
    { answer: 'who-added-prices', value: 'خالد' },
    'git show HEAD~2 -- prices.json',
    { answer: 'old-price', value: '12' },
  ],
};
