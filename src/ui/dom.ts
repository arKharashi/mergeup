export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "9:05 ص" or "9:05 AM" from minutes since 9:00. */
export function clockText(minute: number, lang: 'ar' | 'en'): string {
  const h = 9 + Math.floor(minute / 60);
  const m = minute % 60;
  const h12 = h > 12 ? h - 12 : h;
  const half = h < 12 ? { ar: ' ص', en: ' AM' } : { ar: ' م', en: ' PM' };
  return h12 + ':' + String(m).padStart(2, '0') + half[lang];
}
