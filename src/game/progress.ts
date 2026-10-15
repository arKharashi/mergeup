/** What we keep between visits. Lives in this browser only (localStorage). */
export interface Progress {
  v: 1;
  name: string;
  /** Team reputation, 0..100. Starts at 50. */
  rep: number;
  /** Best stars per level id (1..3). */
  stars: Record<number, number>;
  /** Highest level the player may open. */
  unlocked: number;
  /** The level to resume. */
  level: number;
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const STORAGE_KEY = 'git-together:progress:v1';
/** The game was called Zumala Git; progress saved under that name still loads, and moves on the next save. */
const OLD_STORAGE_KEY = 'zumala-git:progress:v1';

export const freshProgress = (): Progress => ({ v: 1, name: '', rep: 50, stars: {}, unlocked: 1, level: 1 });

/** localStorage can be missing or throw (private windows, blocked storage). */
export function browserStore(): KeyValueStore {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage blocked: progress lasts for this visit only */
      }
    },
  };
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}

export function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    if (p.v !== 1 || typeof p.name !== 'string') return null;
    return {
      ...freshProgress(),
      ...p,
      rep: clamp(Number(p.rep ?? 50), 0, 100),
      unlocked: Math.max(1, Number(p.unlocked ?? 1)),
      level: Math.max(1, Number(p.level ?? 1)),
      stars: typeof p.stars === 'object' && p.stars ? p.stars : {},
    };
  } catch {
    return null;
  }
}

export const loadProgress = (store: KeyValueStore): Progress =>
  parseProgress(store.get(STORAGE_KEY) ?? store.get(OLD_STORAGE_KEY)) ?? freshProgress();

export const saveProgress = (store: KeyValueStore, p: Progress): void => store.set(STORAGE_KEY, JSON.stringify(p));

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export const totalStars = (p: Progress): number => Object.values(p.stars).reduce((a, b) => a + b, 0);
