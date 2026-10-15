/**
 * Terminal colours, matching what real git prints:
 * g green, r red, y yellow, c cyan, bl blue (folders, paths), b bold, d dim, p prompt.
 */
export type Tone = '' | 'g' | 'r' | 'y' | 'c' | 'bl' | 'b' | 'd' | 'p';
export type Segment = readonly [text: string, tone?: Tone];

/** Where commands write. The UI terminal implements it; tests use BufferOut. */
export interface Out {
  line(segments: readonly Segment[]): void;
  print(text: string, tone?: Tone): void;
  /** A coaching line in Arabic. Backticks mark `code`. */
  tip(text: string): void;
  clear(): void;
}

/** Collects output as plain text. Used by tests. */
export class BufferOut implements Out {
  lines: string[] = [];
  tips: string[] = [];

  line(segments: readonly Segment[]): void {
    this.lines.push(segments.map((s) => s[0]).join(''));
  }
  print(text: string): void {
    for (const l of text.split('\n')) this.lines.push(l);
  }
  tip(text: string): void {
    this.tips.push(text);
    this.lines.push('» ' + text);
  }
  clear(): void {
    this.lines = [];
  }
  text(): string {
    return this.lines.join('\n');
  }
  /** Returns everything printed since the last call. */
  take(): string {
    const t = this.text();
    this.lines = [];
    this.tips = [];
    return t;
  }
}
