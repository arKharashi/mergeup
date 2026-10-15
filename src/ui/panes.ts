export type Pane = 'team' | 'term' | 'files';

// Match the breakpoints in styles.css.
const PHONE = 760;
const TABLET = 1099;
/** Landscape phones are wide enough for two columns but too short, so they get the phone layout. */
const SHORT = 520;

const phoneLayout = (): boolean => window.innerWidth <= PHONE || (window.innerWidth <= TABLET && window.innerHeight <= SHORT);

/**
 * Desktop shows all three panes. Tablets show the task pane plus the terminal or the files.
 * Phones show one pane at a time, switched by tabs.
 */
export function isVisible(pane: Pane, current: Pane): boolean {
  if (window.innerWidth > TABLET) return true;
  if (phoneLayout()) return current === pane;
  return pane === 'team' || (pane === 'files' ? current === 'files' : current !== 'files');
}

/** The pane to start a level on. */
export const defaultPane = (): Pane => (phoneLayout() ? 'team' : 'term');

/** Focusing the command line on a phone would pop up its keyboard over the task. */
export const isWide = (): boolean => !phoneLayout();
