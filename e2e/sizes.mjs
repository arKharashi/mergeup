// UI at every screen size: layout mode, scrolling, controls on screen, clipped text, overlapping header parts.
import { KEYS, REPO, Report, cmd, open, progress, settle, shot } from './lib.mjs';

export const SIZES = [
  [320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932], // phones
  [568, 320], [667, 375], [844, 390], [932, 430], // phones, landscape
  [600, 960], [760, 1024], [761, 1024], [768, 1024], [820, 1180], [1024, 768], [1024, 1366], [1099, 800], // tablets
  [1100, 800], [1280, 720], [1280, 600], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], // desktops
];

const mode = (w, h) => (w > 1099 ? 'desktop' : w <= 760 || h <= 520 ? 'phone' : 'tablet');

/** Layout facts gathered inside the page. */
function measure() {
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const rect = (el) => el.getBoundingClientRect();
  const W = innerWidth;
  const H = innerHeight;
  const out = { W, H, problems: [] };
  out.pageScroll = document.documentElement.scrollWidth > W ? 'x' : document.documentElement.scrollHeight > H + 1 ? 'y' : '';
  out.cols = ['.col-team', '.col-term', '.col-files'].filter((s) => vis(document.querySelector(s)));
  out.tabs = [...document.querySelectorAll('#tabs button')].filter(vis).map((b) => b.dataset.pane);
  // Anything interactive must sit inside the screen horizontally.
  for (const el of document.querySelectorAll('button, input, textarea, [role=tab]')) {
    if (!vis(el) || el.closest('[hidden]')) continue;
    const b = rect(el);
    if (b.width === 0) continue;
    if (b.left < -1 || b.right > W + 1) out.problems.push(`off-screen x: ${el.id || el.className || el.tagName} [${Math.round(b.left)}..${Math.round(b.right)}]`);
  }
  // Text that doesn't fit its box.
  for (const el of document.querySelectorAll('.btn, .tabs button, .rank, .col-head h2, .starcount, .eyebrow, .brand h1, .opts button, .meter label, .card h2')) {
    if (!vis(el)) continue;
    if (el.scrollWidth > el.clientWidth + 1) out.problems.push(`clipped text: ${(el.id || el.className).toString().slice(0, 30)} "${el.textContent.trim().slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth}`);
  }
  // Header parts must not overlap.
  const parts = ['.brand', '.rank', '.track', '.meters'].map((s) => [s, document.querySelector(s)]).filter(([, el]) => vis(el));
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const a = rect(parts[i][1]);
      const b = rect(parts[j][1]);
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.problems.push(`header overlap: ${parts[i][0]} / ${parts[j][0]}`);
    }
  // Panes that are on screen need room to be used.
  const term = document.querySelector('.term');
  if (vis(term)) {
    out.termH = Math.round(rect(term).height);
    const cmd = rect(document.querySelector('#cmd'));
    if (cmd.bottom > H + 1 || cmd.top < 0) out.problems.push('command line off screen');
  }
  const chat = document.querySelector('.chat');
  if (vis(chat)) out.chatH = Math.round(rect(chat).height);
  const task = document.querySelector('.task');
  if (vis(task)) out.taskClipped = task.scrollHeight > task.clientHeight + 1;
  // A pane must never be scrolled as a whole (that cut the task card's title off).
  for (const col of document.querySelectorAll('.col')) if (vis(col) && col.scrollTop > 0) out.problems.push(`${col.className} scrolled by ${col.scrollTop}px`);
  // The newest hint is on screen inside the task card.
  const hint = document.querySelector('.hint > div:last-child');
  if (vis(task) && hint) {
    const t = rect(task);
    const h = rect(hint);
    if (h.top < t.top - 1 || h.top > t.bottom - 10) out.problems.push('newest hint out of view');
  }
  const card = document.querySelector('#overlay .card');
  if (vis(card)) {
    const b = rect(card);
    if (b.top < -1 || b.bottom > H + 1 || b.left < -1 || b.right > W + 1) out.problems.push('card off screen');
    out.cardScrolls = card.scrollHeight > card.clientHeight + 1;
  }
  return out;
}

export async function sizes(browser, lang, engine, list = SIZES, shots = new Set()) {
  const r = new Report(`sizes · ${lang} · ${engine}`);
  const notes = [];
  for (const [w, h] of list) {
    const id = `${w}x${h}`;
    const mobile = w <= 932 && Math.min(w, h) <= 430;
    const seedLang = { [KEYS.lang]: lang };
    const expectLayout = (m, where) => {
      const kind = mode(w, h);
      if (kind === 'desktop') r.check(m.cols.length === 3 && m.tabs.length === 0, `${id} ${where}: desktop shows 3 columns, no tabs`, JSON.stringify(m.cols));
      else if (kind === 'tablet') r.check(m.cols.length === 2 && m.cols[0] === '.col-team' && m.tabs.join() === 'term,files', `${id} ${where}: tablet shows task + one pane, 2 tabs`, JSON.stringify([m.cols, m.tabs]));
      else r.check(m.cols.length === 1 && m.tabs.length === 3, `${id} ${where}: phone shows one pane, 3 tabs`, JSON.stringify([m.cols, m.tabs]));
    };
    const verify = (m, where) => {
      r.check(!m.pageScroll, `${id} ${where}: no page scroll`, m.pageScroll);
      r.check(m.problems.length === 0, `${id} ${where}: layout clean`, m.problems.join('; '));
      if (m.termH !== undefined) r.check(m.termH >= 60, `${id} ${where}: terminal has room (${m.termH}px)`);
      if (m.chatH !== undefined) r.check(m.chatH >= 60, `${id} ${where}: chat has room (${m.chatH}px)`);
      if (m.taskClipped) notes.push(`${id} ${where}: task card scrolls`);
      if (m.cardScrolls) notes.push(`${id} ${where}: card scrolls`);
    };

    // 1. Welcome card.
    {
      const { page, errors, ctx } = await open(browser, { viewport: { width: w, height: h }, mobile, seed: seedLang });
      await page.waitForSelector('#pname', { state: 'visible' });
      verify(await page.evaluate(measure), 'welcome');
      if (shots.has(id)) await shot(page, `size-${lang}-${id}-welcome`);
      r.check(errors.length === 0, `${id} welcome: no console errors`, errors.join(' | '));
      await ctx.close();
    }

    // 2. A level in progress, every pane.
    {
      const { page, errors, ctx } = await open(browser, { viewport: { width: w, height: h }, mobile, seed: { ...seedLang, [KEYS.progress]: progress() } });
      await settle(page);
      const tabs = await page.locator('#tabs button:visible').count();
      if (!(await page.locator('#cmd').isVisible())) await page.locator('#tabs [data-pane="term"]').click();
      await cmd(page, 'git clone ' + REPO);
      await cmd(page, 'cd bun-cafe');
      await cmd(page, 'git status');
      if (!(await page.locator('#files').isVisible())) await page.locator('#tabs [data-pane="files"]').click();
      await page.click('#files button:has-text("README.md")');
      if (!(await page.locator('#hintBtn').isVisible())) await page.locator('#tabs [data-pane="team"]').click();
      await page.click('#hintBtn');
      await page.click('#hintBtn');
      for (const p of tabs ? ['team', 'term', 'files'] : ['all']) {
        if (p !== 'all') {
          const tab = page.locator(`#tabs [data-pane="${p}"]`);
          if (!(await tab.isVisible())) continue; // tablets keep the team pane, without a tab
          await tab.click();
        }
        const m = await page.evaluate(measure);
        expectLayout(m, `level/${p}`);
        verify(m, `level/${p}`);
        if (shots.has(id)) await shot(page, `size-${lang}-${id}-level-${p}`);
      }
      r.check(errors.length === 0, `${id} level: no console errors`, errors.join(' | '));
      await ctx.close();
    }

    // 3. The longest card: promotion at the end of level 3.
    {
      const { page, errors, ctx } = await open(browser, { viewport: { width: w, height: h }, mobile, seed: { ...seedLang, [KEYS.progress]: progress({ unlocked: 3, level: 3, stars: { 1: 3, 2: 3 } }) } });
      await settle(page);
      if (!(await page.locator('#cmd').isVisible())) await page.locator('#tabs [data-pane="term"]').click();
      for (const line of ['echo ".env" > .gitignore', 'git add .gitignore', 'git commit -m "Ignore local env file"', 'git add menu.html', 'git commit -m "Add karak tea to the menu"', 'git add style.css', 'git commit -m "Increase menu font size"', 'git add prices.json', 'git commit -m "Lower Spanish latte price to 17"', 'git push'])
        await cmd(page, line);
      await page.waitForSelector('#overlay .card #ok', { timeout: 10000 });
      verify(await page.evaluate(measure), 'promotion card');
      await page.locator('#overlay #ok').scrollIntoViewIfNeeded();
      r.check(await page.locator('#overlay #ok').isVisible(), `${id} promotion card: OK reachable`);
      if (shots.has(id)) await shot(page, `size-${lang}-${id}-card`);
      r.check(errors.length === 0, `${id} card: no console errors`, errors.join(' | '));
      await ctx.close();
    }
  }
  return { r, notes };
}
