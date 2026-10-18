import type { Out, Segment } from '../output';
import type { Commit } from '../types';

/**
 * The commits `git log` shows: reachable from `starts`, not in `exclude`, children always before parents,
 * and the newest first among the commits that are ready (git log --date-order).
 */
export function walkCommits(commits: Record<string, Commit>, starts: string[], exclude: Set<string>, firstParent: boolean): Commit[] {
  const parentsOf = (c: Commit) => (firstParent ? c.parents.slice(0, 1) : c.parents);
  const reach = new Set<string>();
  const stack = starts.filter((s) => !exclude.has(s));
  while (stack.length) {
    const id = stack.pop()!;
    if (reach.has(id) || exclude.has(id) || !commits[id]) continue;
    reach.add(id);
    stack.push(...parentsOf(commits[id]));
  }
  const children = new Map<string, number>();
  for (const id of reach) for (const p of parentsOf(commits[id]!)) if (reach.has(p)) children.set(p, (children.get(p) ?? 0) + 1);
  const ready = [...new Set(starts)].filter((s) => reach.has(s) && !children.get(s));
  const out: Commit[] = [];
  while (ready.length) {
    let pick = 0;
    for (let i = 1; i < ready.length; i++) if (commits[ready[i]!]!.time > commits[ready[pick]!]!.time) pick = i;
    const c = commits[ready.splice(pick, 1)[0]!]!;
    out.push(c);
    for (const p of parentsOf(c)) {
      if (!reach.has(p)) continue;
      const left = children.get(p)! - 1;
      children.set(p, left);
      if (!left) ready.push(p);
    }
  }
  return out;
}

const pad = (s: string, width: number) => s.padEnd(width);
const bars = (n: number) => (n ? Array(n).fill('|').join(' ') + ' ' : '');

/**
 * The lines `git log --graph` draws: one column per line of history, a star on the commit,
 * `|\` where a merge opens a second column and `|/` where two columns meet again.
 * Covers what the game's histories need: merges of two parents, and columns that rejoin next to each other.
 */
export class Graph {
  private cols: string[] = [];
  private width = 2;
  private pending: string[] = [];

  /** The prefix of a commit's own line. `parents` are those that will be shown. */
  row(c: Commit, parents: string[]): string {
    let at = this.cols.indexOf(c.id);
    if (at < 0) {
      this.cols.push(c.id);
      at = this.cols.length - 1;
    }
    const before = this.cols.length;
    const extra = Math.max(0, parents.length - 1);
    this.width = 2 * Math.max(before + extra, 1);
    const line = pad(this.cols.map((_, i) => (i === at ? '*' : '|')).join(' ') + ' ', this.width);
    if (extra) this.pending.push(pad('| '.repeat(at) + '|\\' + ' \\'.repeat(before - at - 1), this.width));
    this.cols.splice(at, 1, ...parents);
    for (let j = 1; j < this.cols.length; j++) {
      const i = this.cols.indexOf(this.cols[j]!);
      if (i === j) continue;
      this.pending.push(pad('| '.repeat(j - 1) + '|/' + ' /'.repeat(this.cols.length - j - 1), this.width));
      this.cols.splice(j, 1);
      j--;
    }
    return line;
  }

  /** The prefix of the next line that belongs to the last commit (its header, message or stat). */
  next(): string {
    return this.pending.shift() ?? pad(bars(this.cols.length), this.width);
  }

  /** Lines still owed after a commit, such as the `|/` after a one-line commit. */
  flush(): string[] {
    const lines = this.pending;
    this.pending = [];
    return lines;
  }

  /** The prefix of the blank line between two commits. */
  gap(): string {
    return bars(this.cols.length);
  }
}

/** An Out that starts every line with `prefix()`, so stats and diffs follow the graph's columns. */
export function prefixed(out: Out, prefix: () => string): Out {
  return {
    line: (segments: readonly Segment[]) => out.line([[prefix()], ...segments]),
    print: (text, tone) => {
      for (const l of text.split('\n')) out.line([[prefix()], [l, tone]]);
    },
    tip: (text) => out.tip(text),
    clear: () => out.clear(),
  };
}
