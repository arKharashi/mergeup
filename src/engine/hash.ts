/**
 * Commit ids look like real 40-character SHA-1 hashes but are just stable
 * FNV-1a mixes of the commit's content. Good enough for a game, and fast.
 */
function fnv(str: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function sha(str: string): string {
  let out = '';
  for (let k = 1; k <= 5; k++) {
    out += fnv(str + '#' + k, Math.imul(k, 0x9e3779b1) >>> 0)
      .toString(16)
      .padStart(8, '0');
  }
  return out;
}

export const short = (id: string | null | undefined): string => (id ?? '').slice(0, 7);
