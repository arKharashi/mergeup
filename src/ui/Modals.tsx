import { Fragment, useEffect, useRef, useState } from 'react';
import type { Session } from '../game/game';
import { totalStars } from '../game/progress';
import type { Rank } from '../game/ranks';
import { useGame } from './gameContext';
import { Md } from './Md';

export type Modal =
  | { kind: 'welcome' }
  | { kind: 'complete'; session: Session; stars: number; promotedTo: Rank | null }
  | { kind: 'fail'; session: Session; reason: string }
  | { kind: 'confirm'; title: string; text: string; ok: string; onOk: () => void };

interface Props {
  modal: Modal | null;
  onClose: () => void;
  onStart: (name: string) => void;
  onLoad: (level: number, keepPane?: boolean) => void;
}

/** Modal cards: welcome, level complete, level failed, confirmation. Every button closes the card first. */
export function Modals({ modal, onClose, onStart, onLoad }: Props) {
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
        <div className="eyebrow">الفريق لاحظ مشكلة</div>
        <h2>المهمة ما اكتملت</h2>
        <p className="lead">
          <Md text={modal.reason} />
        </p>
        <p>«رجّع الوقت» يعيد المستوى من بدايته. السمعة اللي نقصت تبقى، لأن الفريق ما ينسى بسرعة.</p>
        <div className="actions">
          <button type="button" className="btn primary" id="retry" onClick={then(() => onLoad(id, true))}>
            رجّع الوقت وأعد
          </button>
          <button type="button" className="btn" id="stay" onClick={onClose}>
            خلني أشوف وش صار
          </button>
        </div>
      </>
    );
  } else if (modal?.kind === 'confirm') {
    card = (
      <>
        <h2>{modal.title}</h2>
        <p>{modal.text}</p>
        <div className="actions">
          <button type="button" className="btn primary" id="yes" onClick={then(modal.onOk)}>
            {modal.ok}
          </button>
          <button type="button" className="btn" id="no" onClick={onClose}>
            إلغاء
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
  const [name, setName] = useState('');
  return (
    <>
      <div className="eyebrow">فريق بُن · المكتب الافتراضي</div>
      <h2>حياك في أول وظيفة لك</h2>
      <p className="lead">
        بتشتغل مع فريق صغير على موقع مقهى بُن. المدير والزملاء شخصيات افتراضية، والطرفية تشتغل مثل git الحقيقي.
      </p>
      <p>كل مستوى مهمة من يوم عمل. تترقى من متدرب إلى مدير فريق، وكل غلط له أثر على سمعتك عند الفريق.</p>
      <form
        id="nameForm"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (n) onStart(n);
        }}
      >
        <label htmlFor="pname">وش اسمك؟ يظهر في الـ commits حقتك</label>
        <input
          id="pname"
          maxLength={24}
          placeholder="مثلاً: ريم"
          required
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="actions">
          <button type="submit" className="btn primary">
            ابدأ أول يوم
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
  const lv = session.level;
  const p = game.progress;
  const hasNext = game.isBuilt(lv.id + 1);
  const facts = (
    <ul className="facts">
      <li>
        <span>إنجاز المهمة</span>
        <b>★</b>
      </li>
      <li>
        <span>بدون أخطاء تنقص السمعة</span>
        <b>{session.repLost ? '—' : '★'}</b>
      </li>
      <li>
        <span>بدون الحل الكامل</span>
        <b>{session.usedSolution ? '—' : '★'}</b>
      </li>
      <li>
        <span>سمعتك في الفريق</span>
        <b>{p.rep}</b>
      </li>
    </ul>
  );

  return (
    <>
      {promotedTo ? (
        <>
          <div className="eyebrow">ترقية</div>
          <h2>{'صرت ' + promotedTo.en}</h2>
          <Stars n={stars} />
          <p className="quote">
            {'«' + p.name + '، شغلك نظيف ومرتب. من بكرة تشتغل على فروع خاصة فيك، وخالد بيراجع شغلك قبل ما ينضم للمشروع.» أبو فهد'}
          </p>
          {facts}
          {!hasNext && (
            <p>
              مجموع نجومك: <b className="mono ltr" dir="ltr">{totalStars(p) + ' / ' + game.levels.length * 3}</b>
              {'. مستويات رتبة ' + promotedTo.en + ' قيد البناء.'}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="eyebrow">{'LEVEL ' + lv.id + ' COMPLETE'}</div>
          <h2>{'خلّصت «' + lv.title + '»'}</h2>
          <Stars n={stars} />
          {facts}
        </>
      )}
      <div className="actions">
        {hasNext ? (
          <button type="button" className="btn primary" id="next" onClick={onNext}>
            المستوى التالي
          </button>
        ) : (
          <button type="button" className="btn primary" id="ok" onClick={onOk}>
            تمام
          </button>
        )}
        <button type="button" className="btn" id="again" onClick={onReplay}>
          أعد المستوى
        </button>
      </div>
    </>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <div className="stars" aria-label={n + ' من 3 نجوم'}>
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
