import { $, esc } from './dom';

/** Small "−5 سمعة · reason" notes in the corner. */
export function repToast(delta: number, reason: string): void {
  const t = document.createElement('div');
  t.className = 'toast ' + (delta < 0 ? 'minus' : 'plus');
  t.innerHTML = '<b>' + (delta > 0 ? '+' : '−') + Math.abs(delta) + ' سمعة</b> · ' + esc(reason);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
