import { $ } from './dom';

export type Pane = 'team' | 'term' | 'files';

const PHONE = 760;
const TABLET = 1099;

/**
 * Desktop shows all three panes. Tablets show the task pane plus the terminal or the files.
 * Phones show one pane at a time, switched by tabs.
 */
export class Panes {
  private readonly desk = $('#desk');
  private readonly tabs = $('#tabs');
  onShow: (pane: Pane) => void = () => {};

  constructor() {
    this.tabs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-pane]');
      if (b) this.show(b.dataset.pane as Pane);
    });
  }

  get current(): Pane {
    return this.desk.dataset.pane as Pane;
  }

  show(pane: Pane): void {
    this.desk.dataset.pane = pane;
    this.tabs.querySelectorAll<HTMLButtonElement>('button[data-pane]').forEach((b) => {
      const on = b.dataset.pane === pane;
      b.setAttribute('aria-selected', String(on));
      if (on) b.querySelector('.dot')?.remove();
    });
    this.onShow(pane);
  }

  isVisible(pane: Pane): boolean {
    const w = window.innerWidth;
    if (w > TABLET) return true;
    const cur = this.current;
    if (w > PHONE) return pane === 'team' || (pane === 'files' ? cur === 'files' : cur !== 'files');
    return cur === pane;
  }

  /** Puts a dot on a tab that has news. */
  mark(pane: Pane): void {
    if (this.isVisible(pane)) return;
    const b = this.tabs.querySelector<HTMLButtonElement>('[data-pane="' + pane + '"]');
    if (b && !b.querySelector('.dot')) {
      const d = document.createElement('span');
      d.className = 'dot';
      b.appendChild(d);
    }
  }

  /** The pane to start a level on. */
  defaultPane(): Pane {
    return window.innerWidth <= PHONE ? 'team' : 'term';
  }

  get isWide(): boolean {
    return window.innerWidth > PHONE;
  }
}
