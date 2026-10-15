import { useLayoutEffect, useRef, useState } from 'react';
import { rankOfLevel } from '../game/ranks';
import { useGame } from './gameContext';
import { useLang } from './lang';
import { Md } from './Md';

/**
 * The task card: level title, objectives checklist and hints. Once the level is over it says so,
 * because the result card can be closed and a failed level can't be finished any more.
 * Give it key={session id}: an objective's box pops when it gets done after the card appeared.
 */
export function TaskCard({ onRewind, onNext }: { onRewind: () => void; onNext: (() => void) | null }) {
  const game = useGame();
  const { t } = useLang();
  const objectives = game.objectives();
  const [doneAtStart] = useState(() => objectives.map((o) => o.done));
  const s = game.session;
  const card = useRef<HTMLDivElement>(null);

  // On short screens the card scrolls; bring a new hint or the level's result into view.
  const reveal = (selector: string) => {
    const box = card.current;
    const el = box?.querySelector(selector);
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    if (e.bottom > b.bottom) box.scrollTop += Math.min(e.bottom - b.bottom + 8, e.top - b.top);
    else if (e.top < b.top) box.scrollTop -= b.top - e.top + 8;
  };
  const hintTier = s?.hintTier ?? 0;
  const status = s?.status;
  useLayoutEffect(() => {
    if (hintTier) reveal('.hint > div:last-child');
  }, [hintTier]);
  useLayoutEffect(() => {
    if (status && status !== 'playing') reveal('.task-status');
  }, [status]);

  if (!s) return <div className="task" id="task" ref={card} />;

  const lv = s.level;
  const hints = game.hints();
  return (
    <div className="task" id="task" ref={card}>
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
      {s.status === 'failed' && (
        <div className="task-status failed" role="status">
          <p>{t({ ar: 'المستوى ما نجح، وما يكتمل بعد كذا. «رجّع الوقت» يعيده من بدايته.', en: 'This level failed and can’t be finished now. Rewind to start it over.' })}</p>
          <button type="button" className="btn" onClick={onRewind}>
            {t({ ar: 'رجّع الوقت', en: 'Rewind' })}
          </button>
        </div>
      )}
      {s.status === 'done' && (
        <div className="task-status done" role="status">
          <p>
            {onNext
              ? t({ ar: 'خلّصت المستوى.', en: 'Level complete.' })
              : t({ ar: 'خلّصت المستوى. المستويات الجاية قيد البناء.', en: 'Level complete. More levels are on the way.' })}
          </p>
          {onNext && (
            <button type="button" className="btn primary" onClick={onNext}>
              {t({ ar: 'المستوى التالي', en: 'Next level' })}
            </button>
          )}
        </div>
      )}
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
      <div className="hintrow" hidden={s.status !== 'playing'}>
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
