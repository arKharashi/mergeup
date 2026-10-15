import type { Bilingual } from '../engine';
import { useLang } from './lang';
import type { Pane } from './panes';

const TABS: readonly [Pane, Bilingual][] = [
  ['team', { ar: 'المهمة والفريق', en: 'Task & team' }],
  ['term', { ar: 'التيرمينال', en: 'Terminal' }],
  ['files', { ar: 'الملفات', en: 'Files' }],
];

/** Pane switcher on tablets and phones (styles.css hides it on desktop). A dot marks a pane with news. */
export function Tabs({ current, dots, onShow }: { current: Pane; dots: ReadonlySet<Pane>; onShow: (pane: Pane) => void }) {
  const { t } = useLang();
  return (
    <nav className="tabs" id="tabs" role="tablist">
      {TABS.map(([pane, label]) => (
        <button key={pane} type="button" role="tab" data-pane={pane} aria-selected={current === pane} onClick={() => onShow(pane)}>
          {t(label)}
          {dots.has(pane) && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}
