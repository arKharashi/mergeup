import type { Out, Segment, Tone } from '../engine';
import type { Game } from '../game/game';
import { $, esc, md } from './dom';

/** The terminal pane. It is the engine's `Out`, and it owns the command line. */
export class TerminalView implements Out {
  private readonly el = $('#term');
  private readonly input = $<HTMLInputElement>('#cmd');
  private readonly promptEl = $('#prompt');
  private readonly title = $('#termTitle');
  private history: string[] = [];
  private histPos = 0;
  private game: Game | null = null;

  /* ---------- Out ---------- */

  line(segments: readonly Segment[]): void {
    const d = document.createElement('div');
    d.className = 'tl';
    for (const [text, tone] of segments) {
      const s = document.createElement('span');
      if (tone) s.className = tone;
      s.textContent = text;
      d.appendChild(s);
    }
    this.el.appendChild(d);
  }

  print(text: string, tone?: Tone): void {
    for (const l of text.split('\n')) this.line([[l, tone]]);
  }

  tip(text: string): void {
    const d = document.createElement('div');
    d.className = 'tl tip';
    d.innerHTML = md(text);
    this.el.appendChild(d);
  }

  clear(): void {
    this.el.textContent = '';
  }

  /* ---------- input ---------- */

  attach(game: Game): void {
    this.game = game;
    $('#cmdForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.el.addEventListener('click', () => {
      if (String(window.getSelection() ?? '')) return;
      this.focus();
    });
  }

  focus(): void {
    this.input.focus({ preventScroll: true });
  }

  renderPrompt(): void {
    if (!this.game) return;
    const p = this.game.prompt();
    this.promptEl.innerHTML = esc(p.user) + ':<b>' + esc(p.path) + '</b><em>' + esc(p.branch) + '</em>$';
    this.title.textContent = 'bash · ' + p.path;
  }

  scrollToEnd(): void {
    this.el.scrollTop = this.el.scrollHeight;
  }

  private echo(raw: string): void {
    const p = this.game!.prompt();
    this.line([[p.user + ':', 'p'], [p.path, 'bl'], [p.branch, 'y'], ['$ ', 'p'], [raw]]);
  }

  private submit(): void {
    if (!this.game?.session) return;
    const raw = this.input.value;
    this.input.value = '';
    this.echo(raw);
    if (raw.trim() && this.history[this.history.length - 1] !== raw) this.history.push(raw);
    this.histPos = this.history.length;
    this.game.run(raw);
    this.renderPrompt();
    this.scrollToEnd();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') {
      if (this.histPos > 0) this.input.value = this.history[--this.histPos] ?? '';
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (this.histPos < this.history.length - 1) this.input.value = this.history[++this.histPos] ?? '';
      else {
        this.histPos = this.history.length;
        this.input.value = '';
      }
      e.preventDefault();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.complete();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      this.clear();
    }
  }

  private complete(): void {
    if (!this.game) return;
    const v = this.input.value;
    const words = v.split(' ');
    const last = words[words.length - 1] ?? '';
    const hits = this.game.completions(words).filter((x) => x.startsWith(last));
    if (hits.length === 1) {
      words[words.length - 1] = hits[0]!;
      this.input.value = words.join(' ') + (hits[0]!.endsWith('/') ? '' : ' ');
    } else if (hits.length > 1) {
      let prefix = hits[0]!;
      for (const h of hits) while (!h.startsWith(prefix)) prefix = prefix.slice(0, -1);
      if (prefix.length > last.length) {
        words[words.length - 1] = prefix;
        this.input.value = words.join(' ');
      } else {
        this.echo(v);
        this.print(hits.join('  '));
        this.scrollToEnd();
      }
    }
  }
}
