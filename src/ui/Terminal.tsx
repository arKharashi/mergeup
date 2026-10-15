import {
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useGame } from './gameContext';
import { dirOf, useLang, type Lang } from './lang';
import { Md } from './Md';
import type { TerminalBuffer, TermLine } from './terminalBuffer';

export interface TerminalHandle {
  focus(): void;
  scrollToEnd(): void;
}

/** The terminal pane: what the engine wrote to the buffer, and the command line. */
export function Terminal({ buffer, onRewind, ref }: { buffer: TerminalBuffer; onRewind: () => void; ref?: Ref<TerminalHandle> }) {
  const game = useGame();
  const { lang, t } = useLang();
  const lines = useSyncExternalStore(buffer.subscribe, buffer.getSnapshot);
  const [value, setValue] = useState('');
  const history = useRef<string[]>([]);
  const histPos = useRef(0);
  const out = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const focus = () => input.current?.focus({ preventScroll: true });
  const scrollToEnd = () => {
    if (out.current) out.current.scrollTop = out.current.scrollHeight;
  };
  useImperativeHandle(ref, () => ({ focus, scrollToEnd }), []);
  useLayoutEffect(scrollToEnd, [lines]);

  // Like Terminal.app, the title shows the window's size in columns and rows.
  const [size, setSize] = useState('80×24');
  useLayoutEffect(() => {
    const el = out.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const px = parseFloat(cs.fontSize);
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // Monospace letters are about 0.6em wide.
      const cols = Math.floor(width / (px * 0.6));
      const rows = Math.floor(el.clientHeight / (parseFloat(cs.lineHeight) || px * 1.5));
      if (cols > 0 && rows > 0) setSize(cols + '×' + rows);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const echo = (raw: string) => {
    const p = game.prompt();
    buffer.line([[p.user + ':', 'p'], [p.path, 'bl'], [p.branch, 'y'], ['$ ', 'p'], [raw]]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!game.session) return;
    const raw = value;
    setValue('');
    echo(raw);
    const h = history.current;
    if (raw.trim() && h[h.length - 1] !== raw) h.push(raw);
    histPos.current = h.length;
    game.run(raw);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const h = history.current;
    if (e.key === 'ArrowUp') {
      if (histPos.current > 0) setValue(h[--histPos.current] ?? '');
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (histPos.current < h.length - 1) setValue(h[++histPos.current] ?? '');
      else {
        histPos.current = h.length;
        setValue('');
      }
      e.preventDefault();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      buffer.clear();
    }
  };

  const complete = () => {
    const words = value.split(' ');
    const last = words[words.length - 1] ?? '';
    const hits = game.completions(words).filter((x) => x.startsWith(last));
    if (hits.length === 1) {
      words[words.length - 1] = hits[0]!;
      setValue(words.join(' ') + (hits[0]!.endsWith('/') ? '' : ' '));
    } else if (hits.length > 1) {
      let prefix = hits[0]!;
      for (const h of hits) while (!h.startsWith(prefix)) prefix = prefix.slice(0, -1);
      if (prefix.length > last.length) {
        words[words.length - 1] = prefix;
        setValue(words.join(' '));
      } else {
        echo(value);
        buffer.print(hits.join('  '));
      }
    }
  };

  const p = game.prompt();
  // Terminal.app titles a window after its folder; home is the user's name.
  const folder = p.path === '~' ? 'dev' : p.path.split('/').pop();
  return (
    <section className="col col-term" aria-label={t({ ar: 'التيرمينال', en: 'Terminal' })}>
      <div className="col-head">
        <span className="lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h2 className="ltr" id="termTitle" dir="ltr">
          {folder}
          <span className="tproc"> — bash</span>
          <span className="tsize">{' — ' + size}</span>
        </h2>
        <button
          type="button"
          className="btn"
          id="rewind"
          title={t({ ar: 'يرجّع المستوى لبدايته', en: 'Restart the level from the beginning' })}
          onClick={onRewind}
        >
          {t({ ar: 'رجّع الوقت', en: 'Rewind' })}
        </button>
      </div>
      <div
        className="term"
        id="term"
        ref={out}
        onClick={() => {
          if (!String(window.getSelection() ?? '')) focus();
        }}
      >
        <Lines lines={lines} lang={lang} />
      </div>
      <form className="inputline" id="cmdForm" autoComplete="off" onSubmit={submit}>
        <label className="p" htmlFor="cmd" id="prompt">
          {p.user}:<b>{p.path}</b>
          <em>{p.branch}</em>$
        </label>
        <input
          id="cmd"
          ref={input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="send"
          aria-label={t({ ar: 'اكتب أمر', en: 'Type a command' })}
        />
      </form>
    </section>
  );
}

/** Memoised so typing in the command line doesn't re-render the whole scrollback. */
const Lines = memo(function Lines({ lines, lang }: { lines: readonly TermLine[]; lang: Lang }) {
  return lines.map((l) =>
    l.kind === 'tip' ? (
      <div key={l.id} className="tl tip" dir={dirOf(lang)}>
        <Md text={l.text[lang]} />
      </div>
    ) : (
      <div key={l.id} className="tl">
        {l.segments.map(([text, tone], i) => (
          <span key={i} className={tone || undefined}>
            {typeof text === 'string' ? text : text[lang]}
          </span>
        ))}
      </div>
    ),
  );
});
