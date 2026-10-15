import type { Out, Segment, Tone } from '../engine';

export type TermLine =
  | { id: number; kind: 'out'; segments: readonly Segment[] }
  | { id: number; kind: 'tip'; text: string };

/**
 * Everything the terminal shows. The engine writes to it as its `Out`,
 * and the Terminal component reads it with useSyncExternalStore.
 * Every change makes a new `lines` array, so React can compare snapshots by identity.
 */
export class TerminalBuffer implements Out {
  private lines: readonly TermLine[] = [];
  private nextId = 0;
  private readonly listeners = new Set<() => void>();

  line(segments: readonly Segment[]): void {
    this.set([...this.lines, { id: ++this.nextId, kind: 'out', segments }]);
  }

  print(text: string, tone?: Tone): void {
    for (const l of text.split('\n')) this.line([[l, tone]]);
  }

  tip(text: string): void {
    this.set([...this.lines, { id: ++this.nextId, kind: 'tip', text }]);
  }

  clear(): void {
    this.set([]);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  getSnapshot = (): readonly TermLine[] => this.lines;

  private set(lines: readonly TermLine[]): void {
    this.lines = lines;
    for (const fn of this.listeners) fn();
  }
}
