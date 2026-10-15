import { useRef, useState } from 'react';
import { useGameEvent } from './gameContext';

interface Toast {
  id: number;
  delta: number;
  reason: string;
}

/** Small "−5 سمعة · reason" notes in the corner. */
export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  useGameEvent('rep', ({ delta, reason }) => {
    const id = ++seq.current;
    setToasts((list) => [...list, { id, delta, reason }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  });

  return (
    <div className="toasts" id="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + (t.delta < 0 ? 'minus' : 'plus')}>
          <b>{(t.delta > 0 ? '+' : '−') + Math.abs(t.delta) + ' سمعة'}</b>
          {' · ' + t.reason}
        </div>
      ))}
    </div>
  );
}
