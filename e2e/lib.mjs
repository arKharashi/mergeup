// Helpers for the end-to-end tests: they drive the real app in a real browser engine.
import { mkdirSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright-core';

export const REPO = 'https://repo.bun.local/team/bun-cafe.git';
export const KEYS = { progress: 'git-together:progress:v1', lang: 'git-together:lang' };
const SHOTS = new URL('./shots/', import.meta.url).pathname;

/** Collects checks; a failed check is reported, not thrown, so one run shows every problem. */
export class Report {
  constructor(title) {
    this.title = title;
    this.passed = 0;
    this.failures = [];
  }
  check(ok, what, detail = '') {
    if (ok) this.passed++;
    else this.failures.push(what + (detail ? `  <- ${detail}` : ''));
    return ok;
  }
  print() {
    console.log(`${this.failures.length ? 'FAIL' : 'ok  '} ${this.title}: ${this.passed} passed, ${this.failures.length} failed`);
    for (const f of this.failures) console.log('     - ' + f);
  }
}

/** chromium (Playwright's build), chrome (the installed browser), webkit (Safari's engine) or firefox. */
export function launch(engine) {
  if (engine === 'webkit') return webkit.launch();
  if (engine === 'firefox') return firefox.launch();
  if (engine === 'chrome') return chromium.launch({ channel: 'chrome' });
  return chromium.launch();
}

/**
 * Opens the app in a fresh browser profile. `seed` is written to localStorage before the first load only,
 * so a reload keeps what the app saved. `blocked` makes localStorage throw, like some private windows.
 */
export async function open(browser, { viewport = { width: 1440, height: 900 }, mobile = false, reduced = true, dark = false, seed = null, blocked = false } = {}) {
  const isFirefox = browser.browserType().name() === 'firefox';
  const ctx = await browser.newContext({
    viewport,
    isMobile: mobile && !isFirefox,
    hasTouch: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    colorScheme: dark ? 'dark' : 'light',
  });
  await ctx.addInitScript(
    ({ seed, blocked }) => {
      if (blocked) {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('The operation is insecure.', 'SecurityError');
          },
        });
        return;
      }
      if (seed && !sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    },
    { seed, blocked },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    // A network blip while fetching Google Fonts is not the game's fault.
    if (m.text().startsWith('Failed to load resource') && !m.location().url.startsWith(process.env.E2E_URL)) return;
    errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(process.env.E2E_URL);
  return { ctx, page, errors };
}

/** A saved player, so a test can start past the welcome card. */
export const progress = (o = {}) => ({ v: 1, name: 'Reem', rep: 50, stars: {}, unlocked: 1, level: 1, ...o });

export async function cmd(page, line) {
  await page.fill('#cmd', line);
  await page.press('#cmd', 'Enter');
}

export const termText = (page) => page.locator('#term').innerText();
export const lastTip = (page) => page.locator('#term .tl.tip').last().innerText();
export const doneCount = (page) => page.locator('.objs li.done').count();
export const active = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName);
export const noPageScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth);

/** Waits until the chat stops changing and nobody is typing (the chat paces teammates' messages). */
export async function settle(page, quiet = 350) {
  let last = -1;
  let since = Date.now();
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const n = await page.evaluate(() => document.querySelectorAll('.chat .msg').length + (document.querySelector('.chat .typing') ? 1000 : 0));
    if (n !== last) {
      last = n;
      since = Date.now();
    } else if (n < 1000 && Date.now() - since >= quiet) return;
    await page.waitForTimeout(60);
  }
}

export async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: SHOTS + name + '.png' });
}
