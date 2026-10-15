import type { Pane } from './panes';

const TABS: readonly [Pane, string][] = [
  ['team', 'المهمة والفريق'],
  ['term', 'الطرفية'],
  ['files', 'الملفات'],
];

/** Pane switcher on tablets and phones (styles.css hides it on desktop). A dot marks a pane with news. */
export function Tabs({ current, dots, onShow }: { current: Pane; dots: ReadonlySet<Pane>; onShow: (pane: Pane) => void }) {
  return (
    <nav className="tabs" id="tabs" role="tablist">
      {TABS.map(([pane, label]) => (
        <button key={pane} type="button" role="tab" data-pane={pane} aria-selected={current === pane} onClick={() => onShow(pane)}>
          {label}
          {dots.has(pane) && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}
