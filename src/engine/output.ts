/**
 * Terminal colours, matching what real git prints:
 * g green, r red, y yellow, c cyan, bl blue (folders, paths), b bold, d dim, p prompt.
 */
export type Tone = '' | 'g' | 'r' | 'y' | 'c' | 'bl' | 'b' | 'd' | 'p';

/** Player-facing copy in both languages; the UI shows the one the player picked. Backticks mark `code`. */
export interface Bilingual {
  ar: string;
  en: string;
}

/** Plain text is the same in both languages (git output). Bilingual text is coaching, such as the help descriptions. */
export type Segment = readonly [text: string | Bilingual, tone?: Tone];

/** Where commands write. The UI terminal implements it; tests use BufferOut. */
export interface Out {
  line(segments: readonly Segment[]): void;
  print(text: string, tone?: Tone): void;
  /** A coaching line. */
  tip(text: Bilingual): void;
  clear(): void;
}

/** Collects output as plain text, in Arabic. Used by tests. */
export class BufferOut implements Out {
  lines: string[] = [];
  tips: Bilingual[] = [];

  line(segments: readonly Segment[]): void {
    this.lines.push(segments.map(([t]) => (typeof t === 'string' ? t : t.ar)).join(''));
  }
  print(text: string): void {
    for (const l of text.split('\n')) this.lines.push(l);
  }
  tip(text: Bilingual): void {
    this.tips.push(text);
    this.lines.push('» ' + text.ar);
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
