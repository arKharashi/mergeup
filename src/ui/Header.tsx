import { totalStars } from '../game/progress';
import { PLANNED_LEVELS, RANKS } from '../game/ranks';
import { useGame } from './gameContext';

/** Brand, rank chip, the 16-level track, reputation meter and star count. */
export function Header({ onPickLevel }: { onPickLevel: (n: number) => void }) {
  const game = useGame();
  const p = game.progress;
  const r = game.playerRank();
  const current = game.session?.level.id;

  const cell = (i: number) => {
    const built = game.isBuilt(i);
    const open = game.canOpen(i);
    const cls = ['cell'];
    if (p.stars[i]) cls.push('done');
    else if (open) cls.push('open');
    if (current === i) cls.push('current');
    if (!built) cls.push('soon');
    const label =
      'المستوى ' + i + (built ? (p.stars[i] ? ' · ' + p.stars[i] + ' من 3 نجوم' : open ? '' : ' · مقفل') : ' · قريباً');
    return (
      <button
        key={i}
        type="button"
        className={cls.join(' ')}
        data-level={i}
        title={label}
        aria-label={label}
        aria-disabled={open ? undefined : true}
        aria-current={current === i ? 'step' : undefined}
        onClick={() => {
          if (open && i !== current) onPickLevel(i);
        }}
      />
    );
  };

  return (
    <header className="top">
      <div className="brand">
        <h1>
          زملاء <b>Git</b>
        </h1>
        <small>مكتبك الافتراضي في فريق بُن</small>
      </div>
      <span className="rank" id="rank" title="رتبتك في الفريق">
        <span className="en">{r.en}</span>
        <span>{r.ar}</span>
      </span>
      <div className="track" id="track" aria-label="المستويات">
        {RANKS.map((rk) => {
          const cells = [];
          for (let i = rk.from; i <= Math.min(rk.to, PLANNED_LEVELS); i++) cells.push(cell(i));
          return (
            <div key={rk.id} className="track-group">
              <span>{rk.en}</span>
              <div className="track-cells">{cells}</div>
            </div>
          );
        })}
      </div>
      <div className="meters">
        <div className="meter">
          <label>
            السمعة في الفريق <b id="repNum">{p.rep}</b>
          </label>
          <div className="bar">
            <i id="repBar" className={p.rep < 30 ? 'low' : undefined} style={{ width: p.rep + '%' }} />
          </div>
        </div>
        <span className="starcount" id="starCount" title="مجموع النجوم">
          {'★ ' + totalStars(p) + ' / ' + game.levels.length * 3}
        </span>
      </div>
    </header>
  );
}
