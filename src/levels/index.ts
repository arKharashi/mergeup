import type { Level } from '../game/level';
import { level01 } from './l01-first-day';
import { level02 } from './l02-project-history';
import { level03 } from './l03-tidy-commits';
import { level04 } from './l04-first-branch';
import { level05 } from './l05-first-pull-request';

/**
 * Every playable level, in order. Level n must sit at index n - 1.
 * The full plan (16 levels, 4 ranks) is in docs/design.md.
 */
export const LEVELS: Level[] = [level01, level02, level03, level04, level05];
