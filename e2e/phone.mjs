// The full course on a phone: one pane at a time, switched by tabs, with touch and full motion.
import { REPO, Report, active, cmd, doneCount, noPageScroll, open, settle, shot } from './lib.mjs';

export async function phone(browser, lang, engine, viewport = { width: 390, height: 844 }) {
  const r = new Report(`course · phone ${viewport.width}x${viewport.height} · ${lang} · ${engine}`);
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const tag = `phone-${lang}-${engine}-${viewport.width}x${viewport.height}`;
  const { page, errors, ctx } = await open(browser, { viewport, mobile: true, reduced: false });
  const tap = (sel) => page.locator(sel).first().tap();
  const pane = async (p) => {
    await tap(`#tabs [data-pane="${p}"]`);
    r.check((await page.getAttribute('#desk', 'data-pane')) === p, `tab ${p} shows its pane`);
  };
  const fits = async (where) => r.check(await noPageScroll(page), `${where}: no page scroll`);
  const inView = async (sel, where) => {
    const ok = await page.locator(sel).evaluate((el) => {
      const b = el.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= innerHeight + 1 && b.left >= 0 && b.right <= innerWidth + 1;
    });
    r.check(ok, `${where}: ${sel} fully on screen`);
  };

  await page.waitForSelector('#pname', { state: 'visible' });
  if (lang === 'ar') await tap('#overlay .langbtn');
  await fits('welcome');
  await inView('#nameForm button[type=submit]', 'welcome');
  await page.fill('#pname', L('ريم', 'Reem'));
  await tap('#nameForm button[type=submit]');
  r.check((await page.getAttribute('#desk', 'data-pane')) === 'team', 'starts on the task and team pane');
  r.check((await active(page)) !== 'cmd', 'does not pop the keyboard by focusing the command line');
  r.check((await page.locator('#tabs button').count()) === 3 && (await page.locator('#tabs [data-pane="team"]').isVisible()), 'three tabs');

  /* ---------- level 1 ---------- */
  await page.waitForSelector('.chat .msg.sys');
  await pane('term');
  await page.waitForSelector('#tabs [data-pane="team"] .dot', { timeout: 12000 });
  r.check(true, 'team tab gets a dot when a teammate writes elsewhere');
  await inView('#cmd', 'terminal');
  await cmd(page, 'git clone ' + REPO);
  await cmd(page, 'cd bun-cafe');
  await fits('terminal');
  await shot(page, tag + '-1-terminal');
  await pane('files');
  await tap('#files button:has-text("README.md")');
  await page.fill('#edText', (await page.inputValue('#edText')) + L('- ريم — متدرب', '- Reem — Intern') + '\n');
  await inView('#edSave', 'editor');
  await tap('#edSave');
  await fits('files');
  await shot(page, tag + '-2-files');
  await pane('term');
  for (const line of ['git add README.md', 'git commit -m "Add Reem to the team list"', 'git push']) await cmd(page, line);
  await pane('team');
  r.check(!(await page.locator('#tabs [data-pane="team"] .dot').isVisible()), 'opening the team tab clears its dot');
  r.check((await doneCount(page)) === 5, 'all objectives ticked');
  await page.waitForSelector('#overlay .card #next', { timeout: 30000 });
  await fits('complete card');
  await inView('#overlay #next', 'complete card');
  await shot(page, tag + '-3-complete');
  await tap('#overlay #next');

  /* ---------- level 2 ---------- */
  r.check((await page.getAttribute('#desk', 'data-pane')) === 'team', 'next level starts on the team pane');
  await page.waitForSelector('.opts button', { timeout: 30000 });
  await page.locator('.opts').last().locator('button', { hasText: L('خالد', 'Khalid') }).tap();
  await page.waitForFunction(() => document.querySelectorAll('.opts').length === 2, null, { timeout: 30000 });
  await page.locator('.opts').last().locator('button', { hasText: '12' }).tap();
  await settle(page);
  await shot(page, tag + '-4-questions');
  await pane('term');
  await cmd(page, 'git log --oneline');
  await pane('team');
  await page.waitForSelector('#overlay .card #next', { timeout: 30000 });
  await tap('#overlay #next');

  /* ---------- level 3 ---------- */
  await pane('term');
  for (const line of [
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
  ])
    await cmd(page, line);
  await fits('terminal after level 3');
  await page.waitForSelector('#overlay .card #next', { timeout: 30000 });
  await inView('#overlay #next', 'promotion card');
  await fits('promotion card');
  await shot(page, tag + '-5-promotion');
  await tap('#overlay #next');
  r.check((await page.textContent('#rank')).includes('Junior'), 'promoted to Junior');

  /* ---------- level 4 ---------- */
  await pane('term');
  for (const line of ['git switch -c feature/about', 'git add about.html', 'git commit -m "Add about page"', 'git push -u origin feature/about']) await cmd(page, line);
  await fits('terminal after level 4');
  await page.waitForSelector('#overlay .card #ok', { timeout: 30000 });
  await inView('#overlay #ok', 'level 4 card');
  await tap('#overlay #ok');
  r.check(errors.length === 0, 'no console errors or warnings', errors.join(' | '));
  await ctx.close();
  return r;
}
