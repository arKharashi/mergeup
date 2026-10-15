import { cloneRepo } from '../engine';
import { same, type Choice, type Level } from '../game/level';
import { TEAM, npcName, type NpcId } from '../game/team';
import { REPO_DIR, bunCafeHistory } from './fixtures';

/** A teammate as an answer. The value is the name git shows for them. */
const teammate = (id: NpcId): Choice => ({ value: TEAM[id].name, label: npcName(id) });

/**
 * Level 2 (Intern): reading the project's history.
 * Abu Fahd asks two questions in the chat; the answers are in git log / git show.
 */
export const level02: Level = {
  id: 2,
  rank: 'intern',
  title: { ar: 'تاريخ المشروع', en: 'Project history' },
  summary: {
    ar: 'كل تعديل في المشروع انحفظ: مين سواه، ومتى، ووش غيّر. أبو فهد عنده سؤالين.',
    en: 'Every change to the project is on record: who made it, when, and what it changed. Abu Fahd has two questions.',
  },

  setup(player) {
    const remote = bunCafeHistory(player);
    return { remote, local: cloneRepo(remote, REPO_DIR) };
  },

  intro(api) {
    api.say('system', { ar: 'اليوم الثاني · المشروع عندك جاهز في bun-cafe', en: 'Day two · The project is ready for you in bun-cafe' });
    api.say('abufahd', {
      ar: 'صباح الخير يا ' + api.player + '. اليوم أبيك تتعرف على تاريخ المشروع، لأن نص شغلنا قراءة لشغل غيرنا.',
      en: 'Morning, ' + api.player + '. Today I want you to get to know the project’s history, because half our job is reading other people’s work.',
    });
    api.say(
      'abufahd',
      { ar: 'سؤال أول: ملف الأسعار `prices.json`، مين أضافه للمشروع؟', en: 'First question: who added the price list, `prices.json`, to the project?' },
      {
        question: {
          id: 'who-added-prices',
          options: [teammate('abufahd'), teammate('sara'), teammate('khalid'), teammate('noura')],
          answer: TEAM.khalid.name,
          right(api) {
            api.say('abufahd', {
              ar: 'صح، خالد أضافه. شفته في الـ log؟ كل سطر في المشروع وراه اسم.',
              en: 'Right, Khalid added it. See it in the log? Every line in the project has a name behind it.',
            });
            api.say(
              'abufahd',
              {
                ar: 'سؤال ثاني: سارة غيّرت سعر القهوة السعودية قبل كم يوم. كم كان السعر قبل تعديلها؟',
                en: 'Second question: Sara changed the price of Saudi coffee a few days ago. What was the price before her change?',
              },
              {
                question: {
                  id: 'old-price',
                  options: ['10', '12', '15', '18'].map(same),
                  answer: '12',
                  wrong(api, value) {
                    if (value === '15') {
                      api.say('abufahd', {
                        ar: 'هذا السعر بعد تعديلها. أبي اللي قبله. افتح الـ commit حقها بـ `git show`.',
                        en: 'That’s the price after her change. I want the one before. Open her commit with `git show`.',
                      });
                    } else {
                      api.say('abufahd', {
                        ar: 'قريب، بس لا. `git show` على commit سارة يوريك السطر القديم بالأحمر.',
                        en: 'Close, but no. `git show` on Sara’s commit shows you the old line in red.',
                      });
                    }
                  },
                },
              },
            );
          },
          wrong(api) {
            api.say('abufahd', {
              ar: 'لا، مو هو. لا تخمّن: `git log -- prices.json` يوريك مين لمس الملف.',
              en: 'No, not them. Don’t guess: `git log -- prices.json` shows you who touched the file.',
            });
          },
        },
      },
    );
  },

  objectives: [
    { text: { ar: 'اعرض تاريخ المشروع بـ `git log`', en: 'Show the project’s history with `git log`' }, done: (api) => !!api.ran.log },
    {
      text: { ar: 'جاوب: مين أضاف `prices.json`؟', en: 'Answer: who added `prices.json`?' },
      done: (api) => !!api.answers['who-added-prices'],
    },
    {
      text: { ar: 'جاوب: كم كان سعر القهوة السعودية قبل آخر تعديل؟', en: 'Answer: what did Saudi coffee cost before the last change?' },
      done: (api) => !!api.answers['old-price'],
    },
  ],

  hints: [
    {
      ar: 'كل commit فيه اسم صاحبه. ابدأ بعرض قائمة الـ commits.',
      en: 'Every commit carries its author’s name. Start by listing the commits.',
    },
    {
      ar: '`git log -- prices.json` يعرض بس الـ commits اللي لمست الملف. و `git show <hash>` يوريك وش تغيّر بالضبط.',
      en: '`git log -- prices.json` lists only the commits that touched the file, and `git show <hash>` shows exactly what changed.',
    },
    {
      ar:
        '`git log -- prices.json` بيطلع لك commitين. الأقدم (تحت) أضافه خالد. ' +
        'انسخ أول 7 حروف من hash الأحدث (حق سارة) واكتب `git show <hash>`: السطر الأحمر فيه السعر القديم 12، والأخضر الجديد 15.',
      en:
        '`git log -- prices.json` shows two commits. Khalid added the older one (at the bottom). ' +
        'Copy the first 7 characters of the newer hash (Sara’s) and run `git show <hash>`: the red line has the old price, 12, and the green one the new price, 15.',
    },
  ],

  help: [
    ['git log', { ar: 'يعرض كل الـ commits بالتفصيل', en: 'lists every commit in detail' }],
    ['git log --oneline', { ar: 'سطر واحد لكل commit', en: 'one line per commit' }],
    ['git log -- <file>', { ar: 'الـ commits اللي غيّرت ملف معيّن', en: 'the commits that changed one file' }],
    ['git show <hash>', { ar: 'وش تغيّر في commit معيّن', en: 'what changed in one commit' }],
    ['git diff <a> <b>', { ar: 'الفرق بين نسختين', en: 'the difference between two versions' }],
  ],

  onComplete(api) {
    api.say('abufahd', {
      ar: 'ممتاز. اللي يعرف يقرأ التاريخ يعرف يحل نص المشاكل قبل ما يسأل أحد.',
      en: 'Excellent. If you can read the history, you can solve half your problems before asking anyone.',
    });
  },

  solution: () => [
    'git log --oneline -- prices.json',
    { answer: 'who-added-prices', value: TEAM.khalid.name },
    'git show HEAD~2 -- prices.json',
    { answer: 'old-price', value: '12' },
  ],
};
