import type { Game, Session } from '../game/game';
import type { Rank } from '../game/ranks';
import { totalStars } from '../game/progress';
import { $, esc, md } from './dom';

/** Modal cards: welcome, level complete, level failed, rewind confirmation. */
export class Overlays {
  private readonly el = $('#overlay');
  private dismissable = true;

  constructor(private readonly game: Game) {
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dismissable) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  private open(html: string, dismissable = true): HTMLElement {
    this.dismissable = dismissable;
    this.el.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + html + '</div>';
    this.el.hidden = false;
    const first = this.el.querySelector<HTMLElement>('input, .btn.primary');
    first?.focus();
    return this.el;
  }

  close(): void {
    this.el.hidden = true;
    this.el.innerHTML = '';
  }

  welcome(onStart: (name: string) => void): void {
    const el = this.open(
      '<div class="eyebrow">فريق بُن · المكتب الافتراضي</div>' +
        '<h2>حياك في أول وظيفة لك</h2>' +
        '<p class="lead">بتشتغل مع فريق صغير على موقع مقهى بُن. المدير والزملاء شخصيات افتراضية، والطرفية تشتغل مثل git الحقيقي.</p>' +
        '<p>كل مستوى مهمة من يوم عمل. تترقى من متدرب إلى مدير فريق، وكل غلط له أثر على سمعتك عند الفريق.</p>' +
        '<form id="nameForm"><label for="pname">وش اسمك؟ يظهر في الـ commits حقتك</label>' +
        '<input id="pname" maxlength="24" placeholder="مثلاً: ريم" required autocomplete="given-name">' +
        '<div class="actions"><button type="submit" class="btn primary">ابدأ أول يوم</button></div></form>',
      false,
    );
    $('#nameForm', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $<HTMLInputElement>('#pname', el).value.trim();
      if (!name) return;
      this.close();
      onStart(name);
    });
  }

  complete(s: Session, stars: number, promotedTo: Rank | null, actions: { next: () => void; replay: () => void }): void {
    const lv = s.level;
    const p = this.game.progress;
    const facts =
      '<ul class="facts">' +
      '<li><span>إنجاز المهمة</span><b>★</b></li>' +
      '<li><span>بدون أخطاء تنقص السمعة</span><b>' + (s.repLost ? '—' : '★') + '</b></li>' +
      '<li><span>بدون الحل الكامل</span><b>' + (s.usedSolution ? '—' : '★') + '</b></li>' +
      '<li><span>سمعتك في الفريق</span><b>' + p.rep + '</b></li></ul>';
    const hasNext = this.game.isBuilt(lv.id + 1);
    let body: string;
    if (promotedTo) {
      body =
        '<div class="eyebrow">ترقية</div><h2>صرت ' + esc(promotedTo.en) + '</h2>' + starsHtml(stars) +
        '<p class="quote">«' + esc(p.name) + '، شغلك نظيف ومرتب. من بكرة تشتغل على فروع خاصة فيك، وخالد بيراجع شغلك قبل ما ينضم للمشروع.» أبو فهد</p>' +
        facts +
        (hasNext
          ? ''
          : '<p>مجموع نجومك: <b class="mono ltr" dir="ltr">' + totalStars(p) + ' / ' + this.game.levels.length * 3 + '</b>. ' +
            'مستويات رتبة ' + esc(promotedTo.en) + ' قيد البناء.</p>');
    } else {
      body = '<div class="eyebrow">LEVEL ' + lv.id + ' COMPLETE</div><h2>خلّصت «' + esc(lv.title) + '»</h2>' + starsHtml(stars) + facts;
    }
    const el = this.open(
      body +
        '<div class="actions">' +
        (hasNext ? '<button type="button" class="btn primary" id="next">المستوى التالي</button>' : '<button type="button" class="btn primary" id="ok">تمام</button>') +
        '<button type="button" class="btn" id="again">أعد المستوى</button></div>',
    );
    el.querySelector('#next')?.addEventListener('click', () => {
      this.close();
      actions.next();
    });
    el.querySelector('#ok')?.addEventListener('click', () => this.close());
    $('#again', el).addEventListener('click', () => {
      this.close();
      actions.replay();
    });
  }

  fail(reason: string, actions: { retry: () => void }): void {
    const el = this.open(
      '<div class="eyebrow">الفريق لاحظ مشكلة</div><h2>المهمة ما اكتملت</h2><p class="lead">' + md(reason) + '</p>' +
        '<p>«رجّع الوقت» يعيد المستوى من بدايته. السمعة اللي نقصت تبقى، لأن الفريق ما ينسى بسرعة.</p>' +
        '<div class="actions"><button type="button" class="btn primary" id="retry">رجّع الوقت وأعد</button>' +
        '<button type="button" class="btn" id="stay">خلني أشوف وش صار</button></div>',
    );
    $('#retry', el).addEventListener('click', () => {
      this.close();
      actions.retry();
    });
    $('#stay', el).addEventListener('click', () => this.close());
  }

  confirm(title: string, text: string, okLabel: string, onOk: () => void): void {
    const el = this.open(
      '<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
        '<div class="actions"><button type="button" class="btn primary" id="yes">' + esc(okLabel) + '</button>' +
        '<button type="button" class="btn" id="no">إلغاء</button></div>',
    );
    $('#yes', el).addEventListener('click', () => {
      this.close();
      onOk();
    });
    $('#no', el).addEventListener('click', () => this.close());
  }
}

function starsHtml(n: number): string {
  let s = '';
  for (let i = 0; i < 3; i++) s += i < n ? '★' : '<span class="off">★</span>';
  return '<div class="stars" aria-label="' + n + ' من 3 نجوم">' + s + '</div>';
}
