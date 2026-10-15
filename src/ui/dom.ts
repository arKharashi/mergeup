export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error('Missing element: ' + selector);
  return el;
}

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Escapes, then turns `code` into <code> and **bold** into <strong>. For Arabic UI copy. */
export const md = (s: string): string =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** "9:05 ص" from minutes since 9:00. */
export function clockText(minute: number): string {
  const h = 9 + Math.floor(minute / 60);
  const m = minute % 60;
  const h12 = h > 12 ? h - 12 : h;
  return h12 + ':' + String(m).padStart(2, '0') + (h < 12 ? ' ص' : ' م');
}
