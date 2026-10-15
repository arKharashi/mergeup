import { useState } from 'react';
import { rankOfLevel } from '../game/ranks';
import { useGame } from './gameContext';
import { useLang } from './lang';
import { Md } from './Md';

/**
 * The task card: level title, objectives checklist and hints.
 * Give it key={session id}: an objective's box pops when it gets done after the card appeared.
 */
export function TaskCard() {
  const game = useGame();
  const { t } = useLang();
  const objectives = game.objectives();
  const [doneAtStart] = useState(() => objectives.map((o) => o.done));
  const s = game.session;
  if (!s) return <div className="task" id="task" />;

  const lv = s.level;
  const hints = game.hints();
  return (
    <div className="task" id="task">
      <div className="eyebrow">{'LEVEL ' + lv.id + ' · ' + rankOfLevel(lv.id).en.toUpperCase()}</div>
      <h3>{t(lv.title)}</h3>
      <p className="sub">{t(lv.summary)}</p>
      <ul className="objs">
        {objectives.map((o, i) => (
          <li key={i} className={o.done ? (doneAtStart[i] ? 'done' : 'done pop') : undefined}>
            <span className="box" aria-hidden="true" />
            <span>
              <Md text={t(o.text)} />
            </span>
          </li>
        ))}
      </ul>
      {hints.length > 0 && (
        <div className="hint">
          {hints.map((h, i) => (
            <div key={i}>
              <div className="tier">{t({ ar: 'تلميح ' + (i + 1) + ' من 3', en: 'Hint ' + (i + 1) + ' of 3' })}</div>
              <p>
                <Md text={t(h)} />
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="hintrow">
        {s.hintTier < 2 && (
          <button type="button" className="btn" id="hintBtn" onClick={() => game.revealHint()}>
            {t({ ar: 'تلميح (' + s.hintTier + '/3)', en: 'Hint (' + s.hintTier + '/3)' })}
          </button>
        )}
        {s.hintTier === 2 && (
          <button type="button" className="btn warn" id="hintBtn" onClick={() => game.revealHint()}>
            {t({ ar: 'اعرض الحل كامل (تخسر نجمة)', en: 'Show the full solution (costs a star)' })}
          </button>
        )}
      </div>
    </div>
  );
}
