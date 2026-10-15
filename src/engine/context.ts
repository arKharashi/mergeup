import type { Out } from './output';
import type { Commit, Tree, World } from './types';

/** Callbacks the game layer gives the engine, so levels can react to what the player does. */
export interface EngineHooks {
  onCommit?(commit: Commit, changed: string[], parentTree: Tree): void;
  /** Runs after a successful push. `pushed` is oldest first. */
  onPush?(pushed: Commit[], branch: string): void;
}

export interface Ctx {
  world: World;
  out: Out;
  hooks: EngineHooks;
  /** Commands that ran successfully this level, e.g. { log: true, show: true }. */
  ran: Record<string, true>;
  /** The level's command cheat sheet, shown by `help`. */
  help: readonly (readonly [string, string])[];
  /**
   * Returns the rank name that unlocks a git subcommand ("Junior"),
   * or null when the player may use it in this level.
   */
  lockedUntil(sub: string): string | null;
}

/** A command returns false when it failed, which stops a `&&` chain. */
export type CommandResult = boolean;
