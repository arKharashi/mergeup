// Cases that need a prepared player or browser: low reputation, name spellings, blocked storage,
// full motion, dark mode and keyboard focus.
import { KEYS, REPO, Report, active, cmd, doneCount, open, progress, settle } from './lib.mjs';

const LANG_KEY = KEYS.lang;
const PROGRESS_KEY = KEYS.progress;

export async function cases(browser, lang, engine) {
  const r = new Report(`cases · ${lang} · ${engine}`);
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const allErrors = [];

  // Reputation under 30: Abu Fahd calls you to his office, and the meter turns red.
  {
    const { page, errors, ctx } = await open(browser, { seed: { [LANG_KEY]: lang, [PROGRESS_KEY]: progress({ rep: 31, unlocked: 2, level: 2 }) } });
    await settle(page);
    r.check((await page.getAttribute('#repBar', 'class')) !== 'low', 'meter not red at 31');
    await page.locator('.opts button', { hasText: L('سارة', 'Sara') }).click();
    await settle(page);
    const chat = await page.locator('.chat').innerText();
    r.check(chat.includes(L('تعال مكتبي', 'Come to my office')), 'below 30: Abu Fahd calls you in');
    r.check((await page.getAttribute('#repBar', 'class')) === 'low' && (await page.textContent('#repNum')) === '29', 'meter turns red at 29');
    allErrors.push(...errors);
    await ctx.close();
  }

  // The name from the user's report: registered one way, written another.
  {
    const { page, errors, ctx } = await open(browser, { seed: { [LANG_KEY]: lang, [PROGRESS_KEY]: progress({ name: 'Abdulrahman' }) } });
    await settle(page);
    r.check((await page.locator('.objs li').nth(1).innerText()).includes('(Abdulrahman)'), 'objective shows the expected name');
    for (const line of ['git clone ' + REPO, 'cd bun-cafe', 'echo "- عبدالرحمن — متدرب" >> README.md', 'git add .', 'git commit -m "Add my name to the team list"', 'git push']) await cmd(page, line);
    await settle(page);
    r.check((await doneCount(page)) === 1, 'a line without the name leaves the objectives open');
    r.check((await page.locator('.chat .msg[data-who="abufahd"]').last().innerText()).includes('«Abdulrahman»'), 'Abu Fahd says which name he expected');
    for (const line of ['echo "- Abdulrahman — Intern" >> README.md', 'git add .', 'git commit -m "Write my name as I signed up"', 'git push']) await cmd(page, line);
    await page.waitForSelector('#overlay .card #next', { timeout: 10000 });
    r.check(true, 'fixing the line and pushing again finishes the level');
    allErrors.push(...errors);
    await ctx.close();
  }
  {
    const { page, errors, ctx } = await open(browser, { seed: { [LANG_KEY]: lang, [PROGRESS_KEY]: progress({ name: 'عبدالرحمن' }) } });
    for (const line of ['git clone ' + REPO, 'cd bun-cafe', 'echo "- عبد الرحمن — متدرب" >> README.md']) await cmd(page, line);
    r.check((await doneCount(page)) === 2, '"عبد الرحمن" counts for "عبدالرحمن"');
    allErrors.push(...errors);
    await ctx.close();
  }

  // Storage that throws (some private windows): the game still runs for this visit.
  {
    const { page, errors, ctx } = await open(browser, { blocked: true });
    await page.waitForSelector('#pname', { state: 'visible' });
    if (lang === 'en') await page.click('#overlay .langbtn');
    r.check((await page.getAttribute('html', 'lang')) === lang, 'blocked storage: language still switches');
    await page.fill('#pname', 'Reem');
    await page.click('#nameForm button[type=submit]');
    await cmd(page, 'git clone ' + REPO);
    r.check((await doneCount(page)) === 1, 'blocked storage: the level plays');
    r.check(errors.filter((e) => e.startsWith('pageerror')).length === 0, 'blocked storage: nothing throws', errors.join(' | '));
    await ctx.close();
  }

  // Full motion: teammates type before each message.
  {
    const { page, errors, ctx } = await open(browser, { reduced: false, seed: { [LANG_KEY]: lang, [PROGRESS_KEY]: progress() } });
    await page.waitForSelector('.chat .typing', { timeout: 3000 });
    const early = await page.locator('.chat .msg[data-who="abufahd"]').count();
    r.check(early < 3, 'messages arrive one at a time', String(early));
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelectorAll('.chat .msg[data-who="abufahd"]').length === 3, null, { timeout: 10000 });
    r.check(Date.now() - t0 > 1000, 'the intro takes a human pace', Date.now() - t0 + 'ms');
    r.check(await page.locator('.chat .typing').isHidden(), 'no typing bubble when idle');
    allErrors.push(...errors);
    await ctx.close();
  }

  // Dark mode: the colour tokens switch, and the new status boxes use them.
  {
    const { page, errors, ctx } = await open(browser, { dark: true, seed: { [LANG_KEY]: lang, [PROGRESS_KEY]: progress({ unlocked: 3, level: 3 }) } });
    await settle(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    r.check(bg === 'rgb(14, 19, 17)', 'dark mode background', bg);
    await cmd(page, 'git add .');
    await cmd(page, 'git commit -m "Add everything"');
    await cmd(page, 'git push');
    await page.waitForSelector('#overlay .card #stay', { timeout: 10000 });
    await page.click('#stay');
    const box = await page.evaluate(() => getComputedStyle(document.querySelector('.task-status')).backgroundColor);
    r.check(box.startsWith('rgba(239, 123, 111'), 'failed box uses the dark --bad-soft', box);
    allErrors.push(...errors);
    await ctx.close();
  }

  // Keyboard: Tab can't leave an open card, and the card's buttons are reachable.
  {
    const { page, errors, ctx } = await open(browser, { seed: { [LANG_KEY]: lang } });
    await page.waitForSelector('#pname', { state: 'visible' });
    const inside = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      inside.push(await page.evaluate(() => !document.activeElement || document.activeElement === document.body || !!document.activeElement.closest('#overlay')));
    }
    r.check(inside.every(Boolean), 'Tab stays inside the welcome card');
    await page.focus('#pname');
    await page.keyboard.type('Reem');
    await page.keyboard.press('Enter');
    r.check(await page.isHidden('#overlay'), 'Enter in the name field starts the game');
    r.check((await active(page)) === 'cmd', 'keyboard lands on the command line');
    allErrors.push(...errors);
    await ctx.close();
  }

  r.check(allErrors.length === 0, 'no console errors or warnings', allErrors.join(' | '));
  return r;
}
