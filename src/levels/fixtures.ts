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

/**
 * The project's history before the player's first day, plus (optionally)
 * the player's level-1 commit. Commit ids are stable for a given player name.
 */
export function bunCafeHistory(player: Person | null): RemoteRepo {
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
  return buildRemote(REPO_URL, steps);
}

/** True when `content` has a line with the player's name that wasn't in the team list before. */
export function hasPlayerLine(content: string | undefined, name: string): boolean {
  if (!content || !name) return false;
  const before = new Set(lines(README_V2));
  return lines(content).some((l) => l.includes(name) && !before.has(l));
}
