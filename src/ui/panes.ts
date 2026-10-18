/** `web` is the team repo's pull request page, from level 5. It shares the terminal's place. */
export type Pane = 'team' | 'term' | 'files' | 'web';

// Match the breakpoints in styles.css.
const PHONE = 760;
const TABLET = 1099;
/** Landscape phones are wide enough for two columns but too short, so they get the phone layout. */
const SHORT = 520;

const phoneLayout = (): boolean => window.innerWidth <= PHONE || (window.innerWidth <= TABLET && window.innerHeight <= SHORT);

/**
 * Desktop shows the task, the files, and the terminal or the pull request page.
 * Tablets show the task pane plus one of the terminal, the files or the pull request page.
 * Phones show one pane at a time, switched by tabs.
 */
export function isVisible(pane: Pane, current: Pane): boolean {
  const second = current === 'files' || current === 'web' ? current : 'term';
  if (window.innerWidth > TABLET) return pane === 'team' || pane === 'files' || pane === (current === 'web' ? 'web' : 'term');
  if (phoneLayout()) return current === pane;
  return pane === 'team' || pane === second;
}

/** The pane to start a level on. */
export const defaultPane = (): Pane => (phoneLayout() ? 'team' : 'term');

/** Focusing the command line on a phone would pop up its keyboard over the task. */
export const isWide = (): boolean => !phoneLayout();
