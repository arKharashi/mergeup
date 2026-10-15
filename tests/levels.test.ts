import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels';
import { REPO_URL } from '../src/levels/fixtures';
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
