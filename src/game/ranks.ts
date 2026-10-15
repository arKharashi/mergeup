export type RankId = 'intern' | 'junior' | 'senior' | 'lead';

export interface Rank {
  id: RankId;
  en: string;
  ar: string;
  /** First and last level of the rank. */
  from: number;
  to: number;
}

/** Matches the level map in docs/design.md: 16 levels over 4 ranks. */
export const RANKS: readonly Rank[] = [
  { id: 'intern', en: 'Intern', ar: 'متدرب', from: 1, to: 3 },
  { id: 'junior', en: 'Junior', ar: 'مبتدئ', from: 4, to: 6 },
  { id: 'senior', en: 'Senior', ar: 'خبير', from: 7, to: 11 },
  { id: 'lead', en: 'Team Lead', ar: 'مدير فريق', from: 12, to: 16 },
];

export const PLANNED_LEVELS = 16;

export function rankOfLevel(level: number): Rank {
  return RANKS.find((r) => level >= r.from && level <= r.to) ?? RANKS[RANKS.length - 1]!;
}

const order = (id: RankId) => RANKS.findIndex((r) => r.id === id);

/**
 * The rank at which a git feature opens up. Anything not listed is open from the start.
 * Keys are git subcommands, plus a few pseudo-keys the engine asks about:
 * "branch create", "push --force".
 */
export const UNLOCKS: Readonly<Record<string, RankId>> = {
  switch: 'junior',
  'branch create': 'junior',
  merge: 'junior',
  stash: 'senior',
  revert: 'senior',
  'cherry-pick': 'senior',
  rebase: 'senior',
  'push --force': 'senior',
  bisect: 'senior',
  tag: 'lead',
  reflog: 'lead',
};

/** Returns the rank name that unlocks `feature`, or null when it's open at `rank`. */
export function lockedUntil(feature: string, rank: RankId): string | null {
  const needed = UNLOCKS[feature];
  if (!needed || order(rank) >= order(needed)) return null;
  return RANKS[order(needed)]!.en;
}
