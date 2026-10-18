import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels';
import { mergeBase, reviewDecision } from '../src/engine';
import { ABOUT_JS, ABOUT_JS_FIXED, REPO_URL } from '../src/levels/fixtures';
import { PLAYER, makeGame, play } from './helpers';

describe('every level', () => {
  it('sits at the right index and has a unique id', () => {
    LEVELS.forEach((lv, i) => expect(lv.id).toBe(i + 1));
  });

  for (const lv of LEVELS) {
    it(`level ${lv.id} (${lv.title}): the scripted solution earns 3 stars`, () => {
      const { game } = makeGame();
      game.progress.unlocked = lv.id;
      let stars = 0;
      game.on('complete', (e) => (stars = e.stars));
      game.loadLevel(lv.id);
      expect(game.objectives().every((o) => o.done)).toBe(false);
      play(game, lv.solution(PLAYER));
      expect(game.objectives().filter((o) => !o.done).map((o) => o.text)).toEqual([]);
      expect(game.session!.status).toBe('done');
      expect(stars).toBe(3);
      expect(game.progress.unlocked).toBe(lv.id + 1);
    });

    it(`level ${lv.id}: hints and help are filled in`, () => {
      const { game } = makeGame();
      game.progress.unlocked = lv.id;
      game.loadLevel(lv.id);
      game.revealHint();
      game.revealHint();
      game.revealHint();
      expect(game.hints()).toHaveLength(3);
      expect(game.hints().every((h) => h.ar.length > 10 && h.en.length > 10)).toBe(true);
      expect(lv.help.length).toBeGreaterThan(0);
      expect(game.session!.usedSolution).toBe(true);
    });

    it(`level ${lv.id}: everything the player reads comes in Arabic and English`, () => {
      const { game, out } = makeGame('Reem');
      game.progress.unlocked = lv.id;
      game.loadLevel(lv.id);
      play(game, lv.solution('Reem'));
      game.revealHint();
      game.revealHint();
      game.revealHint();
      const s = game.session!;
      const copy = [
        lv.title,
        lv.summary,
        ...game.objectives().map((o) => o.text),
        ...game.hints(),
        ...lv.help.map(([, d]) => d),
        ...s.chat.filter((m) => m.who !== 'you').map((m) => m.text),
        ...out.tips,
        // Reviews on the code host's pull requests.
        ...(s.world.remote.pulls ?? []).flatMap((p) =>
          p.events.flatMap((e) => (e.kind === 'review' ? [e.review.body, ...e.review.comments.map((c) => c.body)] : [])),
        ),
      ];
      for (const c of copy) {
        expect(c.ar.trim(), c.en).not.toBe('');
        expect(c.en.trim(), c.ar).not.toBe('');
        // English may quote Arabic (the README's «الفريق» heading), but not be Arabic.
        expect(c.en.replace(/«[^»]*»/g, ''), c.ar).not.toMatch(/[\u0600-\u06FF]/);
      }
    });
  }
});

describe('level 1: first day', () => {
  it('works with a name that matches a teammate', () => {
    const { game } = makeGame('خالد');
    game.loadLevel(1);
    game.run('git clone ' + REPO_URL);
    game.run('cd bun-cafe');
    game.run('echo "تعديل بسيط" >> README.md');
    expect(game.objectives()[1]!.done).toBe(false);
    play(game, LEVELS[0]!.solution('خالد'));
    expect(game.session!.status).toBe('done');
  });

  it('finds the name however it is spaced, spelled or cased, or by one word of it', () => {
    const cases: [name: string, line: string][] = [
      ['عبدالرحمن', '- عبد الرحمن - متدرب intern'],
      ['عبد الرحمن', '- عبدالرحمن — متدرب'],
      ['أحمد', '- احمد — متدرب'],
      ['Abdulrahman', '- abdulrahman, intern'],
      ['ريم العتيبي', '- ريم — متدرب'],
    ];
    for (const [name, line] of cases) {
      const { game } = makeGame(name);
      game.loadLevel(1);
      play(game, ['git clone ' + REPO_URL, 'cd bun-cafe', 'echo "' + line + '" >> README.md']);
      expect(game.objectives()[1]!.done, name + ' in ' + line).toBe(true);
    }
  });

  it('shows the expected name, and says so when a pushed line has another one', () => {
    const { game } = makeGame('Abdulrahman');
    game.loadLevel(1);
    expect(game.objectives()[1]!.text.en).toContain('(Abdulrahman)');
    play(game, ['git clone ' + REPO_URL, 'cd bun-cafe', 'echo "- عبدالرحمن — متدرب" >> README.md']);
    play(game, ['git add .', 'git commit -m "Add my name to the team list"', 'git push']);
    expect(game.objectives()[4]!.done).toBe(false);
    expect(game.session!.chat.some((m) => m.who === 'abufahd' && m.text.ar.includes('«Abdulrahman»') && m.text.en.includes('«Abdulrahman»'))).toBe(true);
    play(game, ['echo "- Abdulrahman — Intern" >> README.md', 'git add .', 'git commit -m "Write my name as I signed up"', 'git push']);
    expect(game.session!.status).toBe('done');
  });

  it('costs reputation and a star when the commit message is weak', () => {
    const { game } = makeGame();
    let stars = 0;
    game.on('complete', (e) => (stars = e.stars));
    game.loadLevel(1);
    const rep = game.progress.rep;
    play(game, ['git clone ' + REPO_URL, 'cd bun-cafe', 'echo "- ريم" >> README.md', 'git add .', 'git commit -m fix', 'git push']);
    expect(game.progress.rep).toBe(rep - 5);
    expect(stars).toBe(2);
    expect(game.session!.chat.some((m) => m.who === 'abufahd' && m.text.ar.includes('`fix`') && m.text.en.includes('`fix`'))).toBe(true);
  });

  it('promotes to Junior after the last Intern level', () => {
    const { game } = makeGame();
    let promoted = '';
    game.on('complete', (e) => (promoted = e.promotedTo?.en ?? ''));
    game.progress.unlocked = 3;
    game.loadLevel(3);
    play(game, LEVELS[2]!.solution(PLAYER));
    expect(promoted).toBe('Junior');
    expect(game.playerRank().en).toBe('Junior');
  });
});

describe('level 2: project history', () => {
  it('needs git log, and a wrong answer costs reputation', () => {
    const { game } = makeGame();
    game.progress.unlocked = 2;
    game.loadLevel(2);
    const rep = game.progress.rep;
    game.answer('who-added-prices', 'سارة');
    expect(game.progress.rep).toBe(rep - 2);
    expect(game.session!.answers['who-added-prices']).toBeUndefined();
    game.answer('who-added-prices', 'خالد');
    game.answer('old-price', '12');
    expect(game.session!.status).toBe('playing');
    game.run('git log');
    expect(game.session!.status).toBe('done');
  });

  it('ignores answers to questions that were not asked yet', () => {
    const { game } = makeGame();
    game.progress.unlocked = 2;
    game.loadLevel(2);
    game.answer('old-price', '12');
    expect(game.session!.answers['old-price']).toBeUndefined();
  });
});

describe('level 3: tidy commits', () => {
  const start = (): ReturnType<typeof makeGame> => {
    const made = makeGame();
    made.game.progress.unlocked = 3;
    made.game.loadLevel(3);
    return made;
  };

  it('fails when the .env file is pushed', () => {
    const { game } = start();
    let reason = '';
    game.on('fail', (e) => (reason = e.reason.ar));
    play(game, ['git add .', 'git commit -m "Add all of yesterday\'s work"', 'git push']);
    expect(game.session!.status).toBe('failed');
    expect(reason).toContain('.env');
  });

  it('fails when two tasks share a commit', () => {
    const { game } = start();
    play(game, [
      'echo .env > .gitignore',
      'git add .gitignore',
      'git commit -m "Ignore local env file"',
      'git add menu.html style.css',
      'git commit -m "Add karak tea and bigger font"',
      'git add prices.json',
      'git commit -m "Lower Spanish latte price to 17"',
      'git push',
    ]);
    expect(game.session!.status).toBe('failed');
  });

  it('lets the player fix a mixed commit with reset before pushing', () => {
    const { game } = start();
    play(game, [
      'echo .env > .gitignore',
      'git add .gitignore menu.html',
      'git commit -m "Ignore env and add karak tea"',
      'git reset HEAD~1',
      'git add .gitignore',
      'git commit -m "Ignore local env file"',
      'git add menu.html',
      'git commit -m "Add karak tea to the menu"',
      'git add style.css',
      'git commit -m "Increase menu font size"',
      'git add prices.json',
      'git commit -m "Lower Spanish latte price to 17"',
      'git push',
    ]);
    expect(game.session!.status).toBe('done');
  });

  it('accepts the .gitignore in the same commit as one task', () => {
    const { game } = start();
    play(game, [
      'echo .env > .gitignore',
      'git add .gitignore menu.html',
      'git commit -m "Add karak tea and ignore env"',
      'git add style.css',
      'git commit -m "Increase menu font size"',
      'git add prices.json',
      'git commit -m "Lower Spanish latte price to 17"',
      'git push',
    ]);
    expect(game.session!.status).toBe('done');
  });
});

describe('level 4: first branch', () => {
  const start = (): ReturnType<typeof makeGame> & { stars: () => number } => {
    const made = makeGame();
    let stars = 0;
    made.game.on('complete', (e) => (stars = e.stars));
    made.game.progress.unlocked = 4;
    made.game.loadLevel(4);
    return { ...made, stars: () => stars };
  };
  const fromAbuFahd = (game: ReturnType<typeof makeGame>['game']) => game.session!.chat.filter((m) => m.who === 'abufahd');

  it('starts on a protected main, with the About page drafted and the Junior commands open', () => {
    const { game, out } = start();
    const w = game.session!.world;
    expect(w.remote.protectedBranches).toEqual(['main']);
    expect(w.local!.work['about.html']).toContain('<h1>من نحن</h1>');
    expect(game.objectives().map((o) => o.done)).toEqual([false, false, false, false]);
    out.take();
    game.run('git log --oneline -1');
    expect(out.take()).toContain('Lower Spanish latte price to 17');
  });

  it('rejects a push to main, and Abu Fahd explains branches once', () => {
    const { game, out, stars } = start();
    const rep = game.progress.rep;
    const base = game.session!.world.remote.branches.main;
    play(game, ['git add about.html', 'git commit -m "Add about page"']);
    out.take();
    game.run('git push');
    expect(out.take()).toContain(' ! [remote rejected] main -> main (protected branch hook declined)');
    expect(game.session!.world.remote.branches.main).toBe(base);
    const told = fromAbuFahd(game).slice(2);
    expect(told).toHaveLength(2);
    expect(told[1]!.text.ar).toContain('`feature/`');
    expect(told[1]!.text.en).toContain('`feature/`');
    game.run('git push');
    expect(fromAbuFahd(game)).toHaveLength(4);
    expect(game.progress.rep).toBe(rep);
    // The commit on main comes along to the new branch.
    play(game, ['git switch -c feature/about', 'git push -u origin feature/about']);
    expect(game.session!.status).toBe('done');
    expect(game.session!.world.remote.branches.main).toBe(base);
    expect(stars()).toBe(3);
    // He already explained why, so the closing message only says where the page is.
    expect(fromAbuFahd(game)).toHaveLength(5);
    expect(fromAbuFahd(game).at(-1)!.text.en).toContain('next to `main`, not inside it');
  });

  it('explains why at the end to a player who made the branch first', () => {
    const { game } = start();
    play(game, LEVELS[3]!.solution(PLAYER));
    const closing = fromAbuFahd(game).slice(2).map((m) => m.text.en);
    expect(closing).toHaveLength(2);
    expect(closing[0]).toContain('Why a branch?');
    expect(closing[1]).toContain('next to `main`, not inside it');
  });

  it('a branch without feature/ costs reputation, and renaming it fixes the level', () => {
    const { game, stars } = start();
    const rep = game.progress.rep;
    play(game, ['git switch -c about', 'git add about.html', 'git commit -m "Add about page"', 'git push -u origin about']);
    expect(game.session!.status).toBe('playing');
    expect(game.session!.repLost).toBe(true);
    expect(game.progress.rep).toBe(rep - 2 + 3);
    const said = fromAbuFahd(game).at(-1)!.text;
    expect(said.ar).toContain('`git branch -m about feature/about`');
    expect(said.en).toContain('`git branch -m about feature/about`');
    expect(game.objectives().map((o) => o.done)).toEqual([false, false, false, true]);
    play(game, ['git switch main', 'git branch -m about feature/about', 'git switch feature/about', 'git push -u origin feature/about']);
    expect(game.session!.status).toBe('done');
    expect(stars()).toBe(2);
  });

  it('a commit on a branch without feature/ gets a rename tip before any push', () => {
    const { game, out, stars } = start();
    play(game, ['git switch -c feature', 'git add about.html']);
    expect(game.objectives()[0]!.done).toBe(false);
    game.run('git commit -m "Add about page"');
    expect(out.tips.at(-1)!.en).toContain('`git branch -m feature/about`');
    play(game, ['git branch -m feature/about', 'git push -u origin feature/about']);
    expect(game.session!.status).toBe('done');
    expect(stars()).toBe(3);
  });

  it('pushing without -u is caught, and pushing again with -u finishes', () => {
    const { game, out, stars } = start();
    play(game, ['git switch -c feature/about', 'git add about.html', 'git commit -m "Add about page"']);
    out.take();
    game.run('git push');
    expect(out.take()).toContain('fatal: The current branch feature/about has no upstream branch.');
    expect(game.objectives()[2]!.done).toBe(false);
    game.run('git push origin feature/about');
    expect(out.tips.at(-1)!.en).toContain('`git push -u origin feature/about`');
    expect(game.objectives().map((o) => o.done)).toEqual([true, true, false, true]);
    game.run('git push -u origin feature/about');
    expect(out.take()).toContain("branch 'feature/about' set up to track 'origin/feature/about'.\nEverything up-to-date");
    expect(game.session!.status).toBe('done');
    expect(stars()).toBe(3);
  });

  it('a pushed feature branch without the About page is not enough', () => {
    const { game, out } = start();
    play(game, ['git switch -c feature/about', 'git push -u origin feature/about']);
    expect(out.tips.at(-1)!.en).toContain('`about.html` isn’t on it');
    expect(game.objectives().map((o) => o.done)).toEqual([true, false, false, false]);
    play(game, ['git add about.html', 'git commit -m "Add about page"', 'git push']);
    expect(game.session!.status).toBe('done');
  });
});

describe('level 5: first pull request', () => {
  const start = () => {
    const made = makeGame();
    let stars = 0;
    made.game.on('complete', (e) => (stars = e.stars));
    made.game.progress.unlocked = 5;
    made.game.loadLevel(5);
    return { ...made, stars: () => stars };
  };
  const khalid = (game: ReturnType<typeof makeGame>['game']) => game.session!.chat.filter((m) => m.who === 'khalid');
  const commitAndPush = (game: ReturnType<typeof makeGame>['game'], content: string, message = 'Rename hour variable and remove console.log') =>
    play(game, [{ write: 'about.js', content }, 'git add about.js', 'git commit -m "' + message + '"', 'git push']);

  it('starts on feature/about with the script, ready for a pull request', () => {
    const { game } = start();
    const w = game.session!.world;
    expect(w.local!.head).toEqual({ kind: 'branch', name: 'feature/about' });
    expect(w.local!.upstream['feature/about']).toBe('feature/about');
    expect(w.local!.work['about.js']).toBe(ABOUT_JS);
    expect(game.pulls()).toEqual([]);
    expect(game.pullCandidates()).toEqual(['feature/about']);
  });

  it('Khalid asks for two changes, CI fails, and the merge is blocked', () => {
    const { game } = start();
    const pr = game.openPull('feature/about', 'Add the About page')!;
    expect(pr.number).toBe(1);
    expect(game.pullCandidates()).toEqual([]);
    const review = pr.events.at(-1);
    expect(review?.kind === 'review' && review.review.comments.map((c) => c.line)).toEqual([2, 3]);
    expect(reviewDecision(pr)).toBe('changes_requested');
    expect(khalid(game)).toHaveLength(1);
    const [lint] = game.checks(pr);
    expect(lint!.ok).toBe(false);
    expect(lint!.output).toEqual(['about.js', '  3:1  error  Unexpected console statement  no-console', '', '✖ 1 problem (1 error, 0 warnings)']);
    expect(game.mergeBlockers(pr).map((b) => b.en)).toEqual(['The reviewer requested changes.', 'A required CI check is failing.']);
    expect(game.mergePull(1)).toBe(false);
    expect(game.objectives().map((o) => o.done)).toEqual([true, false, false, false]);
  });

  it('removing the console.log turns CI green, but Khalid still wants a clear name', () => {
    const { game } = start();
    game.openPull('feature/about', 'Add the About page');
    commitAndPush(game, ABOUT_JS.replace('console.log(d);\n', ''), 'Remove the console.log from the about script');
    const pr = game.pulls()![0]!;
    expect(game.checks(pr)[0]!.ok).toBe(true);
    expect(reviewDecision(pr)).toBe('changes_requested');
    const last = pr.events.at(-1);
    expect(last?.kind === 'review' && last.review.comments.map((c) => [c.line, c.body.en])).toEqual([[2, expect.stringContaining('`d` doesn’t say what it holds')]]);
    expect(game.objectives().map((o) => o.done)).toEqual([true, true, false, false]);
  });

  it('renaming only where it is declared is caught', () => {
    const { game } = start();
    game.openPull('feature/about', 'Add the About page');
    commitAndPush(game, ABOUT_JS_FIXED.replace('hour >= 7', 'd >= 7'));
    const last = game.pulls()![0]!.events.at(-1);
    expect(last?.kind === 'review' && last.review.comments.map((c) => [c.line, c.body.en])).toEqual([[3, expect.stringContaining('`d` is still used here')]]);
  });

  it('a fix pushed to a new branch doesn’t update the PR, and Khalid says where it goes', () => {
    const { game } = start();
    game.openPull('feature/about', 'Add the About page');
    play(game, ['git switch -c feature/about-fix', { write: 'about.js', content: ABOUT_JS_FIXED }, 'git add about.js', 'git commit -m "Rename hour variable and remove console.log"', 'git push -u origin feature/about-fix']);
    expect(khalid(game).at(-1)!.text.en).toContain('No need for a new branch');
    expect(reviewDecision(game.pulls()![0]!)).toBe('changes_requested');
    // Sending the same commit to the PR's branch fixes it.
    game.run('git push origin feature/about-fix:feature/about');
    expect(reviewDecision(game.pulls()![0]!)).toBe('approved');
  });

  it('a weak commit message costs reputation, and Khalid points it out', () => {
    const { game, stars } = start();
    const rep = game.progress.rep;
    game.openPull('feature/about', 'Add the About page');
    commitAndPush(game, ABOUT_JS_FIXED, 'fix');
    expect(game.progress.rep).toBe(rep - 5);
    expect(khalid(game).some((m) => m.text.ar.includes('`fix`') && m.text.en.includes('`fix`'))).toBe(true);
    expect(reviewDecision(game.pulls()![0]!)).toBe('approved');
    expect(game.mergePull(1)).toBe(true);
    expect(stars()).toBe(2);
  });

  it('merging puts a merge commit on main, and git pull brings it to the player’s main', () => {
    const { game, out } = start();
    play(game, LEVELS[4]!.solution(PLAYER));
    const w = game.session!.world;
    const merge = w.remote.commits[w.remote.branches.main!]!;
    expect(merge.parents).toHaveLength(2);
    expect(merge.message).toBe('Merge pull request #1 from team/feature/about\n\nAdd the About page');
    expect(merge.tree['about.js']).toBe(ABOUT_JS_FIXED);
    expect(mergeBase(w.remote.commits, merge.parents[0]!, merge.parents[1]!)).toBe(merge.parents[0]);
    expect(game.session!.status).toBe('done');
    play(game, ['git switch main']);
    out.take();
    game.run('git pull');
    expect(out.take()).toContain('Fast-forward');
    expect(w.local!.branches.main).toBe(w.remote.branches.main);
  });
});

describe('progress', () => {
  it('survives a reload through the store', async () => {
    const { memoryStore } = await import('../src/game/progress');
    const { Game } = await import('../src/game/game');
    const { BufferOut } = await import('../src/engine');
    const store = memoryStore();
    const a = new Game(LEVELS, new BufferOut(), store);
    a.setPlayerName('  ريم   العتيبي ');
    a.loadLevel(1);
    play(a, LEVELS[0]!.solution('ريم العتيبي'));
    const b = new Game(LEVELS, new BufferOut(), store);
    expect(b.progress.name).toBe('ريم العتيبي');
    expect(b.progress.stars[1]).toBe(3);
    expect(b.progress.unlocked).toBe(2);
  });
});
