import { buildRemote, lines, type HistoryStep, type Person, type RemoteRepo } from '../engine';
import { person } from '../game/team';

/**
 * The team's project: the website of "بُن", a Saudi specialty coffee shop.
 * One project for the whole game; it grows level by level.
 */
export const REPO_URL = 'https://repo.bun.local/team/bun-cafe.git';
export const REPO_DIR = 'bun-cafe';

export const README_V1 = '# بُن\n\nموقع مقهى بُن للقهوة السعودية والمختصة.\n';

export const README_V2 =
  '# بُن\n\nموقع مقهى بُن للقهوة السعودية والمختصة.\n\n## الفريق\n\n' +
  '- أبو فهد — قائد الفريق\n- خالد — مطور أول\n- سارة — مطورة Backend\n- نورة — مطورة Frontend\n';

export const readmeWithPlayer = (name: string): string => README_V2 + '- ' + name + ' — متدرب\n';

export const INDEX_HTML =
  '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <title>بُن</title>\n' +
  '  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>مقهى بُن</h1>\n  <a href="menu.html">المنيو</a>\n</body>\n</html>\n';

export const MENU_V1 =
  '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <title>المنيو | بُن</title>\n' +
  '  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>المنيو</h1>\n  <ul class="menu">\n' +
  '    <li>قهوة سعودية</li>\n    <li>سبانش لاتيه</li>\n    <li>V60</li>\n  </ul>\n</body>\n</html>\n';

export const MENU_WITH_KARAK = MENU_V1.replace('    <li>V60</li>\n', '    <li>V60</li>\n    <li>شاي كرك</li>\n');

export const PRICES_V1 = '{\n  "saudi_coffee": 12,\n  "spanish_latte": 18,\n  "v60": 20\n}\n';
export const PRICES_V2 = PRICES_V1.replace('"saudi_coffee": 12', '"saudi_coffee": 15');
export const PRICES_LATTE_17 = PRICES_V2.replace('"spanish_latte": 18', '"spanish_latte": 17');

export const STYLE_V1 =
  'body {\n  font-family: sans-serif;\n  margin: 0 auto;\n  max-width: 640px;\n}\n\n.menu li {\n  font-size: 14px;\n  color: #6b4423;\n}\n';
export const STYLE_FONT_16 = STYLE_V1.replace('font-size: 14px', 'font-size: 16px');

export const ENV_FILE = 'DB_PASSWORD=bun-secret-2026\n';

/** The About page the player drafted before level 4. */
export const ABOUT_HTML =
  '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <title>من نحن | بُن</title>\n' +
  '  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>من نحن</h1>\n' +
  '  <p>بُن مقهى سعودي للقهوة المختصة. نحمّص البن كل أسبوع، ونقدّم القهوة السعودية بالهيل مع التمر.</p>\n</body>\n</html>\n';

/**
 * The project's history before the player's first day, plus the player's own commits from the levels
 * before `level` (default 2): their name in the README from level 1, the three tidy commits from level 3.
 * Level 1 passes no player. Commit ids are stable for a given player name.
 */
export function bunCafeHistory(player: Person | null, level = 2): RemoteRepo {
  const steps: HistoryStep[] = [
    { author: person('abufahd'), iso: '2026-10-04T09:10:00+03:00', message: 'Initial commit: project skeleton', changes: { 'README.md': README_V1, 'index.html': INDEX_HTML } },
    { author: person('sara'), iso: '2026-10-05T11:32:00+03:00', message: 'Add menu page', changes: { 'menu.html': MENU_V1 } },
    { author: person('khalid'), iso: '2026-10-06T14:05:00+03:00', message: 'Add prices file for menu items', changes: { 'prices.json': PRICES_V1 } },
    { author: person('noura'), iso: '2026-10-07T10:48:00+03:00', message: 'Style the menu page', changes: { 'style.css': STYLE_V1 } },
    { author: person('sara'), iso: '2026-10-11T16:20:00+03:00', message: 'Raise Saudi coffee price to 15', changes: { 'prices.json': PRICES_V2 } },
    { author: person('abufahd'), iso: '2026-10-14T08:55:00+03:00', message: 'Add team section to README', changes: { 'README.md': README_V2 } },
  ];
  if (player) {
    steps.push({
      author: player,
      iso: '2026-10-15T09:30:00+03:00',
      message: 'Add ' + player.name + ' to the team list',
      changes: { 'README.md': readmeWithPlayer(player.name) },
    });
  }
  if (player && level > 3) {
    steps.push(
      { author: player, iso: '2026-10-17T10:05:00+03:00', message: 'Ignore local env file', changes: { '.gitignore': '.env\n' } },
      { author: player, iso: '2026-10-17T10:08:00+03:00', message: 'Add karak tea to the menu', changes: { 'menu.html': MENU_WITH_KARAK } },
      { author: player, iso: '2026-10-17T10:11:00+03:00', message: 'Increase menu font size', changes: { 'style.css': STYLE_FONT_16 } },
      { author: player, iso: '2026-10-17T10:14:00+03:00', message: 'Lower Spanish latte price to 17', changes: { 'prices.json': PRICES_LATTE_17 } },
    );
  }
  return buildRemote(REPO_URL, steps);
}

/**
 * One spelling for the common ways of writing a name: case, spaces, tatweel, tashkeel,
 * and the forms of alef, ya and ta marbuta. "عبد الرحمن" and "عبدالرحمن" fold the same.
 */
const fold = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\s\u0640\u064B-\u065F\u0670\u200B-\u200F]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

/** Non-empty lines of the README that weren't in the team list before. */
export function newLines(content: string | undefined): string[] {
  const before = new Set(lines(README_V2));
  return lines(content ?? '').filter((l) => l.trim() && !before.has(l));
}

/**
 * True when `content` has a new line with the player's name: the whole name, or one word of it
 * with 3+ letters, so "ريم العتيبي" can write just "ريم".
 */
export function hasPlayerLine(content: string | undefined, name: string): boolean {
  if (!content || !fold(name)) return false;
  const words = [fold(name), ...name.split(/\s+/).map(fold).filter((w) => w.length >= 3)];
  return newLines(content).some((l) => words.some((w) => fold(l).includes(w)));
}
