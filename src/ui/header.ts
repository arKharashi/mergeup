import type { Game } from '../game/game';
import { totalStars } from '../game/progress';
import { PLANNED_LEVELS, RANKS } from '../game/ranks';
import { $, esc } from './dom';

/** Rank chip, the 16-level track, reputation meter and star count. */
export class HeaderView {
  private readonly rank = $('#rank');
  private readonly track = $('#track');
  private readonly repNum = $('#repNum');
  private readonly repBar = $('#repBar');
  private readonly stars = $('#starCount');
  /** Asked before switching level (the app may want to confirm first). */
  onPickLevel: (n: number) => void = () => {};

  constructor(private readonly game: Game) {
    this.track.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.cell');
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      const n = Number(b.dataset.level);
      if (n !== this.game.session?.level.id) this.onPickLevel(n);
    });
  }

  render(): void {
    const p = this.game.progress;
    const r = this.game.playerRank();
    this.rank.innerHTML = '<span class="en">' + esc(r.en) + '</span><span>' + esc(r.ar) + '</span>';

    const current = this.game.session?.level.id;
    this.track.innerHTML = RANKS.map((rk) => {
      let cells = '';
      for (let i = rk.from; i <= Math.min(rk.to, PLANNED_LEVELS); i++) {
        const built = this.game.isBuilt(i);
        const open = this.game.canOpen(i);
        const cls = ['cell'];
        if (p.stars[i]) cls.push('done');
        else if (open) cls.push('open');
        if (current === i) cls.push('current');
        if (!built) cls.push('soon');
        const label =
          'المستوى ' + i + (built ? (p.stars[i] ? ' · ' + p.stars[i] + ' من 3 نجوم' : open ? '' : ' · مقفل') : ' · قريباً');
        cells +=
          '<button type="button" class="' + cls.join(' ') + '" data-level="' + i + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"' +
          (open ? '' : ' aria-disabled="true"') + (current === i ? ' aria-current="step"' : '') + '></button>';
      }
      return '<div class="track-group"><span>' + esc(rk.en) + '</span><div class="track-cells">' + cells + '</div></div>';
    }).join('');

    this.repNum.textContent = String(p.rep);
    this.repBar.style.width = p.rep + '%';
    this.repBar.classList.toggle('low', p.rep < 30);
    this.stars.textContent = '★ ' + totalStars(p) + ' / ' + this.game.levels.length * 3;
  }
}
