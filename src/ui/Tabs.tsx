import type { Bilingual } from '../engine';
import { useLang } from './lang';
import type { Pane } from './panes';

/** Each tab's label, and a shorter one for phones when there are four tabs. */
const TABS: readonly [Pane, Bilingual, Bilingual?][] = [
  ['team', { ar: 'المهمة والفريق', en: 'Task & team' }, { ar: 'المهمة', en: 'Task' }],
  ['term', { ar: 'التيرمينال', en: 'Terminal' }],
  ['files', { ar: 'الملفات', en: 'Files' }],
  ['web', { ar: 'طلبات الدمج', en: 'Pull requests' }, { ar: 'الطلبات', en: 'PRs' }],
];

/**
 * Pane switcher. On tablets and phones it switches every pane (styles.css hides it on desktop).
 * When the level has a pull request page (`web`), desktop shows it too, with just the terminal and that page.
 * A dot marks a pane with news.
 */
export function Tabs({ current, dots, web, onShow }: { current: Pane; dots: ReadonlySet<Pane>; web: boolean; onShow: (pane: Pane) => void }) {
  const { t } = useLang();
  return (
    <nav className={web ? 'tabs has-web' : 'tabs'} id="tabs" role="tablist">
      {TABS.filter(([pane]) => web || pane !== 'web').map(([pane, label, short]) => (
        <button key={pane} type="button" role="tab" data-pane={pane} aria-selected={current === pane} aria-label={t(label)} onClick={() => onShow(pane)}>
          <span className="long">{t(label)}</span>
          {short && <span className="short">{t(short)}</span>}
          {dots.has(pane) && <span className="dot" />}
        </button>
      ))}
    </nav>
  );
}
