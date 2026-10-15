import { totalStars } from '../game/progress';
import { PLANNED_LEVELS, RANKS } from '../game/ranks';
import { useGame } from './gameContext';
import { LangToggle, useLang } from './lang';

/** Brand, rank chip, the 16-level track, reputation meter, star count and the language switch. */
export function Header({ onPickLevel }: { onPickLevel: (n: number) => void }) {
  const game = useGame();
  const { lang, t } = useLang();
  const p = game.progress;
  const r = game.playerRank();
  const current = game.session?.level.id;

  const cell = (i: number) => {
    const built = game.isBuilt(i);
    const open = game.canOpen(i);
    const stars = p.stars[i];
    const cls = ['cell'];
    if (stars) cls.push('done');
    else if (open) cls.push('open');
    if (current === i) cls.push('current');
    if (!built) cls.push('soon');
    const label = t({
      ar: 'المستوى ' + i + (built ? (stars ? ' · ' + stars + ' من 3 نجوم' : open ? '' : ' · مقفل') : ' · قريباً'),
      en: 'Level ' + i + (built ? (stars ? ' · ' + stars + ' of 3 stars' : open ? '' : ' · locked') : ' · coming soon'),
    });
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
        <h1 dir="ltr">
          Merge<b>Up</b>
        </h1>
        <small>{t({ ar: 'مكتبك الافتراضي في فريق بُن', en: 'Your virtual desk on the Bun team' })}</small>
      </div>
      <span className="rank" id="rank" title={t({ ar: 'رتبتك في الفريق', en: 'Your rank on the team' })}>
        <span className="en">{r.en}</span>
        {lang === 'ar' && <span>{r.ar}</span>}
      </span>
      <div className="track" id="track" aria-label={t({ ar: 'المستويات', en: 'Levels' })}>
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
            {t({ ar: 'السمعة في الفريق', en: 'Team reputation' })} <b id="repNum">{p.rep}</b>
          </label>
          <div className="bar">
            <i id="repBar" className={p.rep < 30 ? 'low' : undefined} style={{ width: p.rep + '%' }} />
          </div>
        </div>
        <span className="starcount" id="starCount" title={t({ ar: 'مجموع النجوم', en: 'Total stars' })}>
          {'★ ' + totalStars(p) + ' / ' + game.levels.length * 3}
        </span>
        <LangToggle />
      </div>
    </header>
  );
}
