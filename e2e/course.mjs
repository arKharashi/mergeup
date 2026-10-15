// The full course on desktop: a new player goes through every built level, making the usual mistakes on the way.
import { REPO, Report, active, cmd, doneCount, lastTip, noPageScroll, open, settle, shot, termText } from './lib.mjs';

export async function course(browser, lang, engine) {
  const r = new Report(`course · desktop · ${lang} · ${engine}`);
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const tag = `course-${lang}-${engine}`;
  const { page, errors, ctx } = await open(browser);

  /* ---------- onboarding ---------- */
  await page.waitForSelector('#pname', { state: 'visible' });
  r.check((await page.getAttribute('html', 'dir')) === 'rtl', 'default language is Arabic');
  r.check((await active(page)) === 'pname', 'name field focused', await active(page));
  if (lang === 'en') await page.click('#overlay .langbtn');
  r.check((await page.getAttribute('html', 'lang')) === lang, 'html lang is ' + lang);
  r.check((await page.getAttribute('html', 'dir')) === L('rtl', 'ltr'), 'html dir follows the language');
  r.check((await page.title()) === 'Git Together', 'page title');
  r.check((await page.getAttribute('.app', 'inert')) !== null, 'office is inert behind the welcome card');
  await page.keyboard.press('Escape');
  r.check(await page.isVisible('#overlay .card'), 'Escape does not dismiss the welcome card');
  await page.click('#nameForm button[type=submit]');
  r.check(await page.isVisible('#overlay .card'), 'an empty name does not start the game');
  await page.fill('#pname', L('  ريم   العتيبي  ', '  Reem   Alotaibi '));
  await shot(page, tag + '-01-welcome');
  await page.click('#nameForm button[type=submit]');
  r.check(await page.isHidden('#overlay'), 'welcome closes on start');
  r.check((await page.getAttribute('.app', 'inert')) === null, 'office is usable after the welcome');
  await settle(page);
  const chat = await page.locator('.chat').innerText();
  r.check(chat.includes(L('ريم العتيبي', 'Reem Alotaibi')), 'name trimmed and spaces collapsed', chat.slice(0, 120));
  r.check((await active(page)) === 'cmd', 'command line focused after start', await active(page));
  r.check((await page.textContent('#task .eyebrow')) === 'LEVEL 1 · INTERN', 'level 1 loaded');

  /* ---------- level 1: wrong turns ---------- */
  const tipAfter = async (line, ar, en, what) => {
    await cmd(page, line);
    const tip = await lastTip(page);
    r.check(tip.includes(L(ar, en)), what, tip);
  };
  await tipAfter('status', 'نسيت كلمة', 'You left out', 'bare git subcommand: forgot-git tip');
  r.check((await termText(page)).includes('bash: status: command not found'), 'bare subcommand: bash message');
  await tipAfter('git status', 'ما عندك نسخة', 'You don’t have a copy', 'git before cloning: no-copy tip');
  r.check((await termText(page)).includes('fatal: not a git repository'), 'git before cloning: fatal message');
  await tipAfter('cd bun-cafe', 'ما استنسخت', 'haven’t cloned', 'cd before cloning: tip');
  await tipAfter(REPO, 'هذا رابط المشروع', 'That’s the project’s link', 'pasted URL: clone tip');
  r.check((await termText(page)).includes('bash: ' + REPO + ': No such file or directory'), 'pasted URL: bash 5 message');
  await tipAfter('echo "open', 'علامة تنصيص', 'quote', 'unclosed quote: tip');
  await tipAfter('git init', 'ما تحتاج', 'You don’t need', 'git init: tip');
  await cmd(page, 'help');
  r.check((await termText(page)).includes(L('ينسخ المشروع من الفريق لجهازك', 'copies the team’s project to your machine')), 'help in the language');
  await page.fill('#cmd', 'git cl');
  await page.press('#cmd', 'Tab');
  r.check((await page.inputValue('#cmd')) === 'git clone ', 'Tab completes git clone');
  await page.fill('#cmd', '');

  await cmd(page, 'git clone ' + REPO);
  await settle(page);
  r.check((await doneCount(page)) === 1, 'objective 1 ticks after clone');
  r.check((await page.textContent('#repoName')) === 'bun-cafe', 'files panel shows the clone');
  await tipAfter('bun-cafe/', 'تدخله بـ', 'Go into it', 'running a folder: cd tip');
  await cmd(page, 'cd bun-cafe');
  r.check((await page.textContent('#prompt')).includes('(main)'), 'prompt shows the branch');
  await tipAfter('./README.md', 'محتواه', 'See what’s in it', 'running a file: cat tip');
  await tipAfter('git checkout dev', 'Junior', 'Junior rank', 'checkout is locked until Junior');
  await tipAfter('git branch feature', 'إنشاء الفروع', 'Creating branches', 'branch create is locked');
  await tipAfter('git push --force', 'force push', 'force push', 'force push is locked');

  await page.press('#cmd', 'ArrowUp');
  r.check((await page.inputValue('#cmd')) === 'git push --force', 'ArrowUp recalls the last command');
  await page.press('#cmd', 'ArrowDown');
  r.check((await page.inputValue('#cmd')) === '', 'ArrowDown returns to an empty line');
  await page.press('#cmd', 'Control+l');
  r.check((await termText(page)).trim() === '', 'Ctrl+L clears the terminal');

  /* ---------- files panel ---------- */
  await page.click('#files button:has-text("style.css")');
  const css = await page.inputValue('#edText');
  await cmd(page, 'echo "/* note */" >> style.css');
  r.check((await page.inputValue('#edText')).endsWith('/* note */\n'), 'editor follows a command that changes the open file');
  await cmd(page, 'git restore style.css');
  r.check((await page.inputValue('#edText')) === css, 'editor follows git restore');
  await page.fill('#edText', css + '/* draft */\n');
  r.check(await page.isVisible('#edDirty'), 'typing marks the file unsaved');
  await cmd(page, 'echo "/* other */" >> style.css');
  r.check((await page.inputValue('#edText')).endsWith('/* draft */\n'), 'unsaved typing survives a command that changes the file');
  await page.click('#edClose');
  r.check(await page.isHidden('#edText'), 'Close closes the editor');
  r.check((await page.textContent('#files button:has-text("style.css") .badge')) === 'M', 'closing saves the unsaved text (badge M)');
  await cmd(page, 'git restore style.css');
  r.check((await page.locator('#files button:has-text("style.css") .badge').count()) === 0, 'git restore clears the badge');

  await page.click('#newBtn');
  r.check((await active(page)) === 'newName', 'new-file name field focused');
  await page.fill('#newName', 'bad name');
  await page.press('#newName', 'Enter');
  r.check(await page.isVisible('#newError'), 'invalid file name shows an error');
  await page.click('#newCancel');
  r.check(await page.isHidden('#newName'), 'Cancel closes the new-file form');
  await page.click('#newBtn');
  await page.fill('#newName', 'notes.txt');
  await page.press('#newName', 'Enter');
  r.check((await active(page)) === 'edText', 'a new file opens in the editor, focused');
  await page.keyboard.type('hello');
  await page.keyboard.press('Control+s');
  r.check(await page.isHidden('#edDirty'), 'Ctrl+S saves');
  r.check((await page.textContent('#files button:has-text("notes.txt") .badge')) === 'U', 'new file badge U');
  r.check((await page.getAttribute('#files button:has-text("notes.txt") .badge', 'title')) === L('ملف جديد ما يعرفه git', 'New file git doesn’t know yet'), 'badge title in the language');
  await cmd(page, 'rm notes.txt');
  r.check((await page.locator('#files button:has-text("notes.txt")').count()) === 0 && (await page.isHidden('#edText')), 'rm removes the file and closes its editor');

  /* ---------- level 1: the task ---------- */
  await page.click('#files button:has-text("README.md")');
  const readme = await page.inputValue('#edText');
  await page.fill('#edText', readme + L('- ريم — متدرب', '- Reem — Intern') + '\n');
  r.check((await doneCount(page)) === 1, 'unsaved name does not tick the objective yet');
  await page.press('#edText', 'Control+s');
  r.check((await doneCount(page)) === 2, 'first name alone ticks "add your name"');
  await cmd(page, 'git add README.md');
  r.check((await doneCount(page)) === 3, 'git add ticks objective 3');
  r.check((await page.getAttribute('#files button:has-text("README.md") .badge', 'class')).includes('staged'), 'badge turns staged');
  await tipAfter('git commit -m "fix"', 'رسالة الـ commit قصيرة', 'That commit message is short', 'weak commit message: tip');
  r.check((await doneCount(page)) === 4, 'commit ticks objective 4');
  const tipsBefore = await page.locator('#term .tl.tip').count();
  await cmd(page, 'git commit --amend -m "Add Reem to the team list"');
  r.check((await page.locator('#term .tl.tip').count()) === tipsBefore, 'amending with a clear message: no new tip');
  await cmd(page, 'git push');
  r.check((await doneCount(page)) === 5, 'push ticks objective 5');
  await page.waitForSelector('.toast.plus');
  r.check((await page.textContent('.toast.plus')).includes(L('+3 سمعة', '+3 rep')), 'clear push: +3 toast');
  await page.waitForSelector('#overlay .card #next', { timeout: 10000 });
  const lastMsg = await page.locator('.chat .msg[data-who="abufahd"]').last().innerText();
  r.check(lastMsg.includes(L('رسمياً صرت من الفريق', 'officially on the team')), 'team reaction shown before the card', lastMsg);
  r.check((await page.textContent('#overlay .stars')).replace(/\s/g, '') === '★★★', '3 stars');
  r.check((await page.getAttribute('#overlay .card', 'aria-labelledby')) === 'modalTitle', 'dialog named by its heading');
  r.check((await active(page)) === 'next', 'Next level focused');
  await shot(page, tag + '-02-l1-complete');
  await page.keyboard.press('Escape');
  r.check(await page.isHidden('#overlay'), 'Escape closes the complete card');
  r.check((await active(page)) === 'cmd', 'focus returns to the command line', await active(page));
  r.check(await page.isVisible('.task-status.done'), 'task card says the level is done');
  r.check((await page.textContent('#starCount')) === '★ 3 / 9', 'header star count');
  r.check((await page.locator('#track .cell.done').count()) === 1, 'track shows level 1 done');
  await page.click('.task-status.done .btn.primary');

  /* ---------- level 2 ---------- */
  await settle(page);
  r.check((await page.textContent('#task .eyebrow')).startsWith('LEVEL 2'), 'Next level from the task card opens level 2');
  r.check(!(await termText(page)).includes('Level 1'), 'terminal starts fresh');
  const pick = (label) => page.locator('.opts').last().locator('button', { hasText: label });
  await pick(L('سارة', 'Sara')).click();
  await settle(page);
  r.check((await page.locator('.toast.minus').last().textContent()).includes(L('−2 سمعة · إجابة غلط في الشات', '−2 rep · Wrong answer in the chat')), 'wrong answer: −2 toast');
  r.check((await page.locator('.chat .msg[data-who="you"]').last().innerText()).includes(L('سارة', 'Sara')), 'the chosen answer appears as your message');
  r.check((await page.locator('.chat .msg[data-who="abufahd"]').last().innerText()).includes(L('لا، مو هو', 'No, not them')), 'wrong answer: Abu Fahd nudges');
  r.check(!(await pick(L('خالد', 'Khalid')).isDisabled()), 'options stay open after a wrong answer');
  await page.click('#hintBtn');
  await page.click('#hintBtn');
  r.check((await page.textContent('#hintBtn')).includes(L('اعرض الحل كامل', 'Show the full solution')), 'third hint warns it costs a star');
  await page.click('#hintBtn');
  r.check((await page.locator('.hint .tier').count()) === 3 && (await page.locator('#hintBtn').count()) === 0, 'all three hints shown, button gone');
  await pick(L('خالد', 'Khalid')).click();
  await settle(page);
  r.check((await page.locator('.opts').first().locator('button.right').innerText()) === L('خالد', 'Khalid'), 'right answer marked');
  r.check(await page.locator('.opts').first().locator('button').first().isDisabled(), 'answered question locks');
  r.check((await page.locator('.opts').count()) === 2, 'second question arrives');
  await pick('15').click();
  await settle(page);
  r.check((await page.locator('.chat .msg[data-who="abufahd"]').last().innerText()).includes(L('هذا السعر بعد تعديلها', 'That’s the price after her change')), '15: the after-price nudge');
  await pick('10').click();
  await settle(page);
  r.check((await page.locator('.chat .msg[data-who="abufahd"]').last().innerText()).includes(L('قريب، بس لا', 'Close, but no')), '10: the general nudge');
  await pick('12').click();
  await settle(page);
  r.check((await doneCount(page)) === 2 && (await page.isHidden('#overlay')), 'answers alone do not finish without git log');
  await shot(page, tag + '-03-l2-questions');
  await cmd(page, 'git log --oneline');
  await page.waitForSelector('#overlay .card #next', { timeout: 10000 });
  r.check((await page.textContent('#overlay .stars')).replace(/\s/g, '') === '★★★' && (await page.locator('#overlay .stars .off').count()) === 2, 'mistakes and the full solution leave 1 star');
  await page.click('#next');

  /* ---------- level 3 ---------- */
  await settle(page);
  r.check((await page.locator('.chat .msg.alert').count()) === 1, 'the .env warning is a red message');
  await cmd(page, 'git add .');
  await cmd(page, 'git commit -m "Add all of yesterday\'s work"');
  const tips = await page.locator('#term .tl.tip').allInnerTexts();
  r.check(tips.some((t) => t.includes(L('ملف `.env` صار داخل', '.env is now in').replace(/`/g, ''))), 'committing .env: warning tip', tips.slice(-2).join(' | '));
  r.check(tips.some((t) => t.includes(L('مهام مختلفة', 'different tasks'))), 'mixed commit: split tip');
  await cmd(page, 'git push');
  await page.waitForSelector('#overlay .card #retry', { timeout: 10000 });
  r.check((await page.locator('.toast.minus').last().textContent()).includes(L('−15 سمعة', '−15 rep')), 'pushed a password: −15 toast');
  r.check((await page.textContent('#overlay .lead')).includes('.env'), 'fail card explains why');
  r.check((await active(page)) === 'retry', 'Rewind and retry focused');
  await shot(page, tag + '-04-l3-fail');
  await page.click('#stay');
  r.check(await page.isVisible('.task-status.failed'), 'task card says the level failed');
  r.check(await page.isHidden('.hintrow'), 'hints hide once the level is over');
  await page.click('.task-status.failed .btn');
  r.check((await page.textContent('#overlay h2')) === L('ترجّع المستوى لبدايته؟', 'Restart this level?'), 'rewind asks first');
  await page.keyboard.press('Escape');
  r.check(await page.isHidden('#overlay'), 'Escape cancels the rewind');
  await page.click('#rewind');
  await page.click('#yes');
  await settle(page);
  r.check((await page.locator('.task-status').count()) === 0 && (await doneCount(page)) === 0, 'rewind restarts the level');
  r.check((await page.textContent('#files button:has-text(".env") .badge')) === 'U', 'rewind restores the files');

  for (const line of ['echo ".env" > .gitignore', 'git add .gitignore', 'git commit -m "Ignore local env file"', 'git add menu.html style.css', 'git commit -m "Add karak tea and a bigger font"']) await cmd(page, line);
  r.check((await lastTip(page)).includes(L('مهام مختلفة', 'different tasks')), 'mixed commit before pushing: tip');
  await cmd(page, 'git reset HEAD~1');
  for (const line of ['git add menu.html', 'git commit -m "Add karak tea to the menu"', 'git add style.css', 'git commit -m "Increase menu font size"', 'git add prices.json', 'git commit -m "Lower Spanish latte price to 17"']) await cmd(page, line);
  r.check((await doneCount(page)) === 4, 'four objectives done before the push');
  await cmd(page, 'git push');
  await page.waitForSelector('#overlay .card #ok', { timeout: 10000 });
  r.check((await page.textContent('#overlay h2')) === L('صرت Junior', 'You’re a Junior now'), 'promotion card');
  r.check((await page.textContent('#overlay .card')).includes('7 / 9'), 'total stars on the last built level');
  r.check((await page.textContent('#rank')).includes('Junior'), 'rank chip shows Junior');
  await shot(page, tag + '-05-promotion');
  await page.click('#ok');
  r.check((await page.textContent('.task-status.done')).includes(L('قيد البناء', 'on the way')) && (await page.locator('.task-status .btn').count()) === 0, 'last level: no Next, more levels on the way');

  /* ---------- track, reload ---------- */
  await page.click('#track .cell[data-level="4"]', { force: true });
  r.check(await page.isHidden('#overlay') && (await page.textContent('#task .eyebrow')).startsWith('LEVEL 3'), 'an unbuilt level does nothing');
  r.check((await page.getAttribute('#track .cell[data-level="4"]', 'title')).includes(L('قريباً', 'coming soon')), 'unbuilt level says coming soon');
  await page.click('#track .cell[data-level="1"]');
  r.check((await page.textContent('#task .eyebrow')).startsWith('LEVEL 1'), 'a finished level opens without asking');
  await cmd(page, 'git clone ' + REPO);
  await page.click('#track .cell[data-level="2"]');
  r.check((await page.textContent('#overlay h2')) === L('تنتقل للمستوى 2؟', 'Go to level 2?'), 'leaving a level with work asks first');
  await page.click('#no');
  r.check((await page.textContent('#task .eyebrow')).startsWith('LEVEL 1') && (await active(page)) === 'cmd', 'Cancel stays, focus back on the command line');
  await page.reload();
  await page.waitForSelector('#task .eyebrow');
  r.check((await page.textContent('#task .eyebrow')).startsWith('LEVEL 1') && (await page.isHidden('#overlay')), 'reload resumes the last level, no welcome');
  r.check((await page.getAttribute('html', 'lang')) === lang, 'reload keeps the language');
  r.check((await page.textContent('#starCount')) === '★ 7 / 9', 'reload keeps the stars');

  /* ---------- switch language mid-level ---------- */
  await settle(page);
  await page.click('.top .langbtn');
  const other = lang === 'ar' ? 'en' : 'ar';
  r.check((await page.getAttribute('html', 'lang')) === other, 'header switch changes the language');
  r.check((await page.textContent('#task h3')) === (other === 'ar' ? 'أول يوم' : 'First day'), 'task card follows the switch');
  r.check((await page.locator('.chat').innerText()).includes(other === 'ar' ? 'أبو فهد' : 'Abu Fahd'), 'chat history follows the switch');
  await page.click('.top .langbtn');
  r.check((await page.getAttribute('html', 'lang')) === lang, 'and back');
  r.check(await noPageScroll(page), 'page never scrolls (only the panes do)');
  r.check(errors.length === 0, 'no console errors or warnings', errors.join(' | '));
  await ctx.close();
  return r;
}
