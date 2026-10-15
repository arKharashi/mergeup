import type { Game } from '../game/game';
import { rankOfLevel } from '../game/ranks';
import { $, esc, md } from './dom';

/** The task card: level title, objectives checklist and hints. */
export class TaskView {
  private readonly el = $('#task');
  private seen: boolean[] = [];
  private sessionId = -1;

  constructor(private readonly game: Game) {
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'hintBtn') this.game.revealHint();
    });
  }

  render(): void {
    const s = this.game.session;
    if (!s) {
      this.el.innerHTML = '';
      return;
    }
    if (s.id !== this.sessionId) {
      this.sessionId = s.id;
      this.seen = [];
    }
    const lv = s.level;
    const objectives = this.game.objectives();
    const items = objectives
      .map((o, i) => {
        const pop = o.done && this.seen[i] === false;
        this.seen[i] = o.done;
        return (
          '<li class="' + (o.done ? 'done' : '') + (pop ? ' pop' : '') + '">' +
          '<span class="box" aria-hidden="true"></span><span>' + md(o.text) + '</span></li>'
        );
      })
      .join('');

    const hints = this.game.hints();
    const hintHtml = hints.length
      ? '<div class="hint">' +
        hints.map((h, i) => '<div><div class="tier">تلميح ' + (i + 1) + ' من 3</div><p>' + md(h) + '</p></div>').join('') +
        '</div>'
      : '';
    let hintBtn = '';
    if (s.hintTier < 2) hintBtn = '<button type="button" class="btn" id="hintBtn">تلميح (' + s.hintTier + '/3)</button>';
    else if (s.hintTier === 2) hintBtn = '<button type="button" class="btn warn" id="hintBtn">اعرض الحل كامل (تخسر نجمة)</button>';

    this.el.innerHTML =
      '<div class="eyebrow">LEVEL ' + lv.id + ' · ' + esc(rankOfLevel(lv.id).en.toUpperCase()) + '</div>' +
      '<h3>' + esc(lv.title) + '</h3>' +
      '<p class="sub">' + esc(lv.summary) + '</p>' +
      '<ul class="objs">' + items + '</ul>' +
      hintHtml +
      '<div class="hintrow">' + hintBtn + '</div>';
  }
}
