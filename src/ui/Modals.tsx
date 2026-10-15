import { Fragment, useEffect, useRef, useState } from 'react';
import type { Bilingual } from '../engine';
import type { Session } from '../game/game';
import { totalStars } from '../game/progress';
import type { Rank } from '../game/ranks';
import { useGame } from './gameContext';
import { LangToggle, useLang } from './lang';
import { Md } from './Md';

export type Modal =
  | { kind: 'welcome' }
  | { kind: 'complete'; session: Session; stars: number; promotedTo: Rank | null }
  | { kind: 'fail'; session: Session; reason: Bilingual }
  | { kind: 'confirm'; title: Bilingual; text: Bilingual; ok: Bilingual; onOk: () => void };

interface Props {
  modal: Modal | null;
  onClose: () => void;
  onStart: (name: string) => void;
  onLoad: (level: number, keepPane?: boolean) => void;
}

/** Modal cards: welcome, level complete, level failed, confirmation. Every button closes the card first. */
export function Modals({ modal, onClose, onStart, onLoad }: Props) {
  const { t } = useLang();
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal) el.current?.querySelector<HTMLElement>('input, .btn.primary')?.focus();
  }, [modal]);

  const then = (action: () => void) => () => {
    onClose();
    action();
  };

  let card = null;
  if (modal?.kind === 'welcome') {
    card = (
      <Welcome
        onStart={(name) => {
          onClose();
          onStart(name);
        }}
      />
    );
  } else if (modal?.kind === 'complete') {
    const id = modal.session.level.id;
    card = <Complete modal={modal} onNext={then(() => onLoad(id + 1))} onReplay={then(() => onLoad(id, true))} onOk={onClose} />;
  } else if (modal?.kind === 'fail') {
    const id = modal.session.level.id;
    card = (
      <>
        <div className="eyebrow">{t({ ar: 'الفريق لاحظ مشكلة', en: 'The team spotted a problem' })}</div>
        <h2>{t({ ar: 'المهمة ما اكتملت', en: 'The task isn’t done' })}</h2>
        <p className="lead">
          <Md text={t(modal.reason)} />
        </p>
        <p>
          {t({
            ar: '«رجّع الوقت» يعيد المستوى من بدايته. السمعة اللي نقصت تبقى، لأن الفريق ما ينسى بسرعة.',
            en: '“Rewind” restarts the level. The reputation you lost stays lost, because the team doesn’t forget that fast.',
          })}
        </p>
        <div className="actions">
          <button type="button" className="btn primary" id="retry" onClick={then(() => onLoad(id, true))}>
            {t({ ar: 'رجّع الوقت وأعد', en: 'Rewind and retry' })}
          </button>
          <button type="button" className="btn" id="stay" onClick={onClose}>
            {t({ ar: 'خلني أشوف وش صار', en: 'Let me see what happened' })}
          </button>
        </div>
      </>
    );
  } else if (modal?.kind === 'confirm') {
    card = (
      <>
        <h2>{t(modal.title)}</h2>
        <p>{t(modal.text)}</p>
        <div className="actions">
          <button type="button" className="btn primary" id="yes" onClick={then(modal.onOk)}>
            {t(modal.ok)}
          </button>
          <button type="button" className="btn" id="no" onClick={onClose}>
            {t({ ar: 'إلغاء', en: 'Cancel' })}
          </button>
        </div>
      </>
    );
  }

  return (
    <div
      className="overlay"
      id="overlay"
      ref={el}
      hidden={!modal}
      onKeyDown={(e) => {
        // The welcome card needs a name, so it can't be dismissed.
        if (e.key === 'Escape' && modal && modal.kind !== 'welcome') onClose();
      }}
    >
      {card && (
        <div className="card" role="dialog" aria-modal="true">
          {card}
        </div>
      )}
    </div>
  );
}

function Welcome({ onStart }: { onStart: (name: string) => void }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  return (
    <>
      <div className="card-top">
        <div className="eyebrow">{t({ ar: 'فريق بُن · المكتب الافتراضي', en: 'Bun team · Virtual office' })}</div>
        <LangToggle />
      </div>
      <h2>{t({ ar: 'حياك في أول وظيفة لك', en: 'Welcome to your first job' })}</h2>
      <p className="lead">
        {t({
          ar: 'بتشتغل مع فريق صغير على موقع مقهى بُن. المدير والزملاء شخصيات افتراضية، والتيرمينال يشتغل مثل git الحقيقي.',
          en: 'You’ll work with a small team on the website of Bun, a coffee shop. Your manager and teammates are virtual, and the terminal works like real git.',
        })}
      </p>
      <p>
        {t({
          ar: 'كل مستوى مهمة من يوم عمل. تترقى من متدرب إلى مدير فريق، وكل غلط له أثر على سمعتك عند الفريق.',
          en: 'Each level is a task from a workday. You’ll rise from intern to team lead, and every mistake affects your reputation on the team.',
        })}
      </p>
      <form
        id="nameForm"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (n) onStart(n);
        }}
      >
        <label htmlFor="pname">{t({ ar: 'وش اسمك؟ يظهر في الـ commits حقتك', en: 'What’s your name? It goes on your commits.' })}</label>
        <input
          id="pname"
          maxLength={24}
          placeholder={t({ ar: 'مثلاً: ريم', en: 'e.g. Reem' })}
          required
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="actions">
          <button type="submit" className="btn primary">
            {t({ ar: 'ابدأ أول يوم', en: 'Start day one' })}
          </button>
        </div>
      </form>
    </>
  );
}

function Complete({
  modal: { session, stars, promotedTo },
  onNext,
  onReplay,
  onOk,
}: {
  modal: Extract<Modal, { kind: 'complete' }>;
  onNext: () => void;
  onReplay: () => void;
  onOk: () => void;
}) {
  const game = useGame();
  const { t } = useLang();
  const lv = session.level;
  const p = game.progress;
  const hasNext = game.isBuilt(lv.id + 1);
  const facts = (
    <ul className="facts">
      <li>
        <span>{t({ ar: 'إنجاز المهمة', en: 'Task done' })}</span>
        <b>★</b>
      </li>
      <li>
        <span>{t({ ar: 'بدون أخطاء تنقص السمعة', en: 'No mistakes that cost reputation' })}</span>
        <b>{session.repLost ? '—' : '★'}</b>
      </li>
      <li>
        <span>{t({ ar: 'بدون الحل الكامل', en: 'Without the full solution' })}</span>
        <b>{session.usedSolution ? '—' : '★'}</b>
      </li>
      <li>
        <span>{t({ ar: 'سمعتك في الفريق', en: 'Your team reputation' })}</span>
        <b>{p.rep}</b>
      </li>
    </ul>
  );

  return (
    <>
      {promotedTo ? (
        <>
          <div className="eyebrow">{t({ ar: 'ترقية', en: 'Promotion' })}</div>
          <h2>{t({ ar: 'صرت ' + promotedTo.en, en: 'You’re a ' + promotedTo.en + ' now' })}</h2>
          <Stars n={stars} />
          <p className="quote">
            {t({
              ar: '«' + p.name + '، شغلك نظيف ومرتب. من بكرة تشتغل على فروع خاصة فيك، وخالد بيراجع شغلك قبل ما ينضم للمشروع.» أبو فهد',
              en: '“' + p.name + ', your work is clean and tidy. From tomorrow you’ll work on your own branches, and Khalid will review your work before it joins the project.” Abu Fahd',
            })}
          </p>
          {facts}
          {!hasNext && (
            <p>
              {t({ ar: 'مجموع نجومك: ', en: 'Your total stars: ' })}
              <b className="mono ltr" dir="ltr">
                {totalStars(p) + ' / ' + game.levels.length * 3}
              </b>
              {t({
                ar: '. مستويات رتبة ' + promotedTo.en + ' قيد البناء.',
                en: '. The ' + promotedTo.en + ' levels are still being built.',
              })}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="eyebrow">{'LEVEL ' + lv.id + ' COMPLETE'}</div>
          <h2>{t({ ar: 'خلّصت «' + lv.title.ar + '»', en: 'You finished “' + lv.title.en + '”' })}</h2>
          <Stars n={stars} />
          {facts}
        </>
      )}
      <div className="actions">
        {hasNext ? (
          <button type="button" className="btn primary" id="next" onClick={onNext}>
            {t({ ar: 'المستوى التالي', en: 'Next level' })}
          </button>
        ) : (
          <button type="button" className="btn primary" id="ok" onClick={onOk}>
            {t({ ar: 'تمام', en: 'OK' })}
          </button>
        )}
        <button type="button" className="btn" id="again" onClick={onReplay}>
          {t({ ar: 'أعد المستوى', en: 'Replay level' })}
        </button>
      </div>
    </>
  );
}

function Stars({ n }: { n: number }) {
  const { t } = useLang();
  return (
    <div className="stars" aria-label={t({ ar: n + ' من 3 نجوم', en: n + ' of 3 stars' })}>
      {[0, 1, 2].map((i) =>
        i < n ? (
          <Fragment key={i}>★</Fragment>
        ) : (
          <span key={i} className="off">
            ★
          </span>
        ),
      )}
    </div>
  );
}
