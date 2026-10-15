export type Pane = 'team' | 'term' | 'files';

// Match the breakpoints in styles.css.
const PHONE = 760;
const TABLET = 1099;

/**
 * Desktop shows all three panes. Tablets show the task pane plus the terminal or the files.
 * Phones show one pane at a time, switched by tabs.
 */
export function isVisible(pane: Pane, current: Pane): boolean {
  const w = window.innerWidth;
  if (w > TABLET) return true;
  if (w > PHONE) return pane === 'team' || (pane === 'files' ? current === 'files' : current !== 'files');
  return current === pane;
}

/** The pane to start a level on. */
export const defaultPane = (): Pane => (window.innerWidth <= PHONE ? 'team' : 'term');

export const isWide = (): boolean => window.innerWidth > PHONE;
