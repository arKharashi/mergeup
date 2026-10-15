// Plays the game end to end in real browsers: `npm run e2e`.
// E2E_BROWSERS=chromium,webkit,firefox picks the engines (default: chromium).
// E2E_SUITES picks the suites (default: course,cases,phone); add `sizes` for 25 screen sizes (slow).
import { spawn } from 'node:child_process';
import { cases } from './cases.mjs';
import { course } from './course.mjs';
import { launch } from './lib.mjs';
import { phone } from './phone.mjs';
import { sizes } from './sizes.mjs';

const port = Number(process.env.E2E_PORT ?? 5190);
process.env.E2E_URL = `http://localhost:${port}/`;
const engines = (process.env.E2E_BROWSERS ?? 'chromium').split(',');
const suites = new Set((process.env.E2E_SUITES ?? 'course,cases,phone').split(','));
const PHONES = [
  ['ar', { width: 390, height: 844 }],
  ['en', { width: 390, height: 844 }],
  ['ar', { width: 844, height: 390 }],
  ['en', { width: 667, height: 375 }],
];

const root = new URL('..', import.meta.url).pathname;
const server = spawn(process.execPath, [root + 'node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });

async function waitForServer() {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(process.env.E2E_URL)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('The dev server did not start on ' + process.env.E2E_URL);
}

let failed = 0;
async function run(label, fn) {
  try {
    const report = await fn();
    report.print();
    failed += report.failures.length;
  } catch (e) {
    console.log(`FAIL ${label}: stopped at ${String(e.message).split('\n')[0]}`);
    failed++;
  }
}

try {
  await waitForServer();
  for (const engine of engines) {
    const browser = await launch(engine);
    for (const lang of ['ar', 'en']) {
      if (suites.has('course')) await run(`course · ${lang} · ${engine}`, () => course(browser, lang, engine));
      if (suites.has('cases')) await run(`cases · ${lang} · ${engine}`, () => cases(browser, lang, engine));
    }
    if (suites.has('phone')) {
      for (const [lang, viewport] of PHONES) {
        await run(`phone ${viewport.width}x${viewport.height} · ${lang} · ${engine}`, () => phone(browser, lang, engine, viewport));
      }
    }
    if (suites.has('sizes')) {
      for (const lang of ['ar', 'en']) await run(`sizes · ${lang} · ${engine}`, async () => (await sizes(browser, lang, engine)).r);
    }
    await browser.close();
  }
} finally {
  server.kill();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed.');
process.exitCode = failed ? 1 : 0;
