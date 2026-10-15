import type { ChatMessage, Game } from '../game/game';
import { TEAM } from '../game/team';
import { $, clockText, esc, md, reducedMotion } from './dom';

/**
 * The team chat. Messages arrive one by one with a short "typing…" pause,
 * so NPCs feel like people. The game state is already final; this only paces the display.
 */
export class ChatView {
  private readonly el = $('#chat');
  private readonly clock = $('#clock');
  private queue: ChatMessage[] = [];
  private busy = false;
  private generation = 0;
  private idleWaiters: (() => void)[] = [];
  /** Called when a message from someone else appears (to badge the tab on phones). */
  onArrive: () => void = () => {};

  constructor(private readonly game: Game) {
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.opts button');
      if (!b || b.disabled) return;
      this.game.answer(b.dataset.q!, b.dataset.v!);
    });
  }

  reset(): void {
    this.generation++;
    this.queue = [];
    this.busy = false;
    this.el.textContent = '';
    this.clock.textContent = clockText(0);
    this.flushIdle();
  }

  push(msg: ChatMessage): void {
    this.queue.push(msg);
    this.pump();
  }

  /** Resolves once every queued message is on screen. */
  whenIdle(): Promise<void> {
    if (!this.busy && !this.queue.length) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  /** Keeps answer buttons in sync with the game (answered, correct pick). */
  refresh(): void {
    const answers = this.game.session?.answers ?? {};
    this.el.querySelectorAll<HTMLButtonElement>('.opts button').forEach((b) => {
      const answered = answers[b.dataset.q!];
      b.disabled = !!answered || this.game.session?.status !== 'playing';
      b.classList.toggle('right', answered === b.dataset.v);
    });
  }

  private flushIdle(): void {
    const w = this.idleWaiters;
    this.idleWaiters = [];
    w.forEach((r) => r());
  }

  private pump(): void {
    if (this.busy) return;
    const msg = this.queue.shift();
    if (!msg) {
      this.flushIdle();
      return;
    }
    this.busy = true;
    const gen = this.generation;
    const person = msg.who !== 'system' && msg.who !== 'you';
    let typing: HTMLElement | null = null;
    if (person) {
      typing = document.createElement('div');
      typing.className = 'msg';
      typing.innerHTML =
        '<div class="avatar">' + esc(TEAM[msg.who as keyof typeof TEAM].mark) + '</div>' +
        '<div class="typing" aria-label="يكتب"><i></i><i></i><i></i></div>';
      this.el.appendChild(typing);
      this.el.scrollTop = this.el.scrollHeight;
    }
    const delay = reducedMotion() ? 60 : person ? Math.min(1500, 450 + msg.text.length * 9) : 120;
    setTimeout(() => {
      if (gen !== this.generation) return;
      typing?.remove();
      this.render(msg);
      this.clock.textContent = clockText(msg.minute);
      if (person) this.onArrive();
      this.busy = false;
      this.pump();
    }, delay);
  }

  private render(m: ChatMessage): void {
    const d = document.createElement('div');
    if (m.who === 'system') {
      d.className = 'msg sys';
      d.innerHTML = '<span>' + md(m.text) + '</span>';
    } else {
      const name = m.who === 'you' ? this.game.player : TEAM[m.who].name;
      const mark = m.who === 'you' ? (this.game.player.trim().charAt(0) || 'أ') : TEAM[m.who].mark;
      d.className = 'msg' + (m.alert ? ' alert' : '');
      d.dataset.who = m.who;
      let html =
        '<div class="avatar">' + esc(mark) + '</div><div>' +
        '<div class="who">' + esc(name) + '<time>' + clockText(m.minute) + '</time></div>' +
        '<div class="text"><p>' + md(m.text) + '</p>';
      if (m.url) html += '<span class="url" dir="ltr">' + esc(m.url) + '</span>';
      html += '</div>';
      if (m.options && m.questionId) {
        html +=
          '<div class="opts">' +
          m.options.map((o) => '<button type="button" data-q="' + esc(m.questionId!) + '" data-v="' + esc(o) + '">' + esc(o) + '</button>').join('') +
          '</div>';
      }
      html += '</div>';
      d.innerHTML = html;
    }
    this.el.appendChild(d);
    this.refresh();
    this.el.scrollTop = this.el.scrollHeight;
  }
}
