import { useRef, useState } from 'react';
import type { Bilingual } from '../engine';
import { useGameEvent } from './gameContext';
import { useLang } from './lang';

interface Toast {
  id: number;
  delta: number;
  reason: Bilingual;
}

/** Small "−5 سمعة · reason" notes in the corner. */
export function Toasts() {
  const { t } = useLang();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  useGameEvent('rep', ({ delta, reason }) => {
    const id = ++seq.current;
    setToasts((list) => [...list, { id, delta, reason }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4200);
  });

  return (
    <div className="toasts" id="toasts" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={'toast ' + (x.delta < 0 ? 'minus' : 'plus')}>
          <b>
            {/* Isolated, so Arabic text doesn't move the minus sign to the other side of the number. */}
            <span className="ltr">{(x.delta > 0 ? '+' : '−') + Math.abs(x.delta)}</span>
            {t({ ar: ' سمعة', en: ' rep' })}
          </b>
          {' · ' + t(x.reason)}
        </div>
      ))}
    </div>
  );
}
