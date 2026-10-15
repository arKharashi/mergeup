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
import { Md } from './Md';
import type { TerminalBuffer, TermLine } from './terminalBuffer';

export interface TerminalHandle {
  focus(): void;
  scrollToEnd(): void;
}

/** The terminal pane: what the engine wrote to the buffer, and the command line. */
export function Terminal({ buffer, onRewind, ref }: { buffer: TerminalBuffer; onRewind: () => void; ref?: Ref<TerminalHandle> }) {
  const game = useGame();
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
  return (
    <section className="col col-term" aria-label="الطرفية">
      <div className="col-head">
        <h2 className="mono ltr" id="termTitle" dir="ltr">
          {'bash · ' + p.path}
        </h2>
        <button type="button" className="btn" id="rewind" title="يرجّع المستوى لبدايته" onClick={onRewind}>
          رجّع الوقت
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
        <Lines lines={lines} />
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
          aria-label="اكتب أمر"
        />
      </form>
    </section>
  );
}

/** Memoised so typing in the command line doesn't re-render the whole scrollback. */
const Lines = memo(function Lines({ lines }: { lines: readonly TermLine[] }) {
  return lines.map((l) =>
    l.kind === 'tip' ? (
      <div key={l.id} className="tl tip">
        <Md text={l.text} />
      </div>
    ) : (
      <div key={l.id} className="tl">
        {l.segments.map(([text, tone], i) => (
          <span key={i} className={tone || undefined}>
            {text}
          </span>
        ))}
      </div>
    ),
  );
});
