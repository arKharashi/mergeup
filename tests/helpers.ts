import { BufferOut, cloneRepo, type Ctx, type World, runLine } from '../src/engine';
import { Game } from '../src/game/game';
import type { SolutionStep } from '../src/game/level';
import { memoryStore } from '../src/game/progress';
import { LEVELS } from '../src/levels';
import { REPO_DIR, bunCafeHistory } from '../src/levels/fixtures';

export const PLAYER = 'ريم';

/** A bare engine world: the team repo, optionally already cloned. */
export function makeWorld(opts: { cloned?: boolean } = {}): { world: World; out: BufferOut; ctx: Ctx; run: (line: string) => string } {
  const me = { name: PLAYER, email: 'you@bun.team' };
  const remote = bunCafeHistory(me);
  let t = Date.parse('2026-10-16T10:00:00+03:00');
  const world: World = {
    remote,
    local: opts.cloned ? cloneRepo(remote, REPO_DIR) : null,
    cwd: opts.cloned ? '~/' + REPO_DIR : '~',
    me,
    now: () => (t += 60_000),
  };
  const out = new BufferOut();
  const ctx: Ctx = { world, out, hooks: {}, ran: {}, help: [], lockedUntil: () => null };
  const run = (line: string) => {
    runLine(ctx, line);
    return out.take();
  };
  return { world, out, ctx, run };
}

/** A game with a named player and in-memory storage. */
export function makeGame(name = PLAYER): { game: Game; out: BufferOut } {
  const out = new BufferOut();
  const game = new Game(LEVELS, out, memoryStore());
  game.setPlayerName(name);
  return { game, out };
}

export function play(game: Game, steps: SolutionStep[]): void {
  for (const step of steps) {
    if (typeof step === 'string') game.run(step);
    else if ('answer' in step) game.answer(step.answer, step.value);
    else if ('write' in step) game.writeFile(step.write, step.content);
    else if ('openPull' in step) game.openPull(step.openPull, step.title);
    else game.mergePull(step.merge);
  }
}
