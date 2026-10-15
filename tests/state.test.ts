import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, loadProgress, memoryStore, saveProgress } from '../src/game/progress';
import { REPO_URL } from '../src/levels/fixtures';
import { TerminalBuffer } from '../src/ui/terminalBuffer';
import { makeGame } from './helpers';

describe('Game.subscribe and getVersion', () => {
  it('notify after every event, and stop after unsubscribing', () => {
    const { game } = makeGame();
    let calls = 0;
    const off = game.subscribe(() => calls++);
    const v0 = game.getVersion();
    game.loadLevel(1);
    expect(calls).toBeGreaterThan(0);
    expect(game.getVersion()).toBeGreaterThan(v0);

    const before = calls;
    const v1 = game.getVersion();
    game.run('git clone ' + REPO_URL);
    expect(calls).toBeGreaterThan(before);
    expect(game.getVersion()).toBeGreaterThan(v1);

    off();
    const after = calls;
    game.run('cd bun-cafe');
    expect(calls).toBe(after);
  });

  it('keeps the version when nothing happened, so React skips the render', () => {
    const { game } = makeGame();
    game.loadLevel(1);
    const v = game.getVersion();
    game.objectives();
    game.files();
    expect(game.getVersion()).toBe(v);
  });
});

describe('TerminalBuffer', () => {
  it('makes a new snapshot on every change and keeps ids unique', () => {
    const out = new TerminalBuffer();
    let calls = 0;
    out.subscribe(() => calls++);
    const empty = out.getSnapshot();
    out.print('one\ntwo', 'g');
    out.tip({ ar: 'تلميح', en: 'tip' });
    const lines = out.getSnapshot();
    expect(lines).not.toBe(empty);
    expect(lines.map((l) => l.kind)).toEqual(['out', 'out', 'tip']);
    expect(new Set(lines.map((l) => l.id)).size).toBe(3);
    expect(lines[0]).toMatchObject({ kind: 'out', segments: [['one', 'g']] });
    expect(calls).toBe(3);
    expect(out.getSnapshot()).toBe(lines);

    out.clear();
    expect(out.getSnapshot()).toEqual([]);
    out.line([['again']]);
    expect(out.getSnapshot()[0]!.id).toBeGreaterThan(lines[2]!.id);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const out = new TerminalBuffer();
    let calls = 0;
    const off = out.subscribe(() => calls++);
    out.print('a');
    off();
    out.print('b');
    expect(calls).toBe(1);
  });
});

describe('progress saved before the rename', () => {
  it('loads from the Zumala Git key and saves under the new one', () => {
    const store = memoryStore();
    store.set('zumala-git:progress:v1', JSON.stringify({ v: 1, name: 'Reem', rep: 61, stars: { 1: 3 }, unlocked: 2, level: 2 }));
    const p = loadProgress(store);
    expect(p).toMatchObject({ name: 'Reem', rep: 61, unlocked: 2, level: 2 });
    p.rep = 64;
    saveProgress(store, p);
    expect(JSON.parse(store.get(STORAGE_KEY)!).rep).toBe(64);
    expect(loadProgress(store).rep).toBe(64);
  });
});
