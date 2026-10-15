import { useLayoutEffect, useRef } from 'react';
import type { ChatMessage } from '../game/game';
import { TEAM, npcName } from '../game/team';
import { isPerson } from './chatPace';
import { clockText } from './dom';
import { useGame } from './gameContext';
import { useLang, type Lang } from './lang';
import { Md } from './Md';

/**
 * The team chat. Shows the first `shown` messages of the session (see useChatPace),
 * and a "typing…" bubble while the next teammate's message is on its way.
 */
export function ChatPanel({ shown }: { shown: number }) {
  const game = useGame();
  const { lang, t } = useLang();
  const s = game.session;
  const chat = s?.chat ?? [];
  const next = chat[shown];
  const typing = next && isPerson(next.who) ? next.who : null;
  const el = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (el.current) el.current.scrollTop = el.current.scrollHeight;
  }, [s, shown, typing]);

  const answered = s?.answers ?? {};
  const playing = s?.status === 'playing';
  return (
    <>
      <div className="col-head">
        <h2>{t({ ar: 'شات الفريق', en: 'Team chat' })}</h2>
        <span id="clock" className="mono">
          {s ? clockText(shown ? chat[shown - 1]!.minute : 0, lang) : ''}
        </span>
      </div>
      <div className="chat" id="chat" aria-live="polite" ref={el}>
        {chat.slice(0, shown).map((m) => (
          <Message
            key={m.seq}
            m={m}
            lang={lang}
            player={game.player}
            answer={m.questionId ? answered[m.questionId] : undefined}
            playing={playing}
            onAnswer={(q, v) => game.answer(q, v)}
          />
        ))}
        {typing && (
          <div className="msg">
            <div className="avatar">{t(TEAM[typing].mark)}</div>
            <div className="typing" aria-label={t({ ar: 'يكتب', en: 'typing' })}>
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Message({
  m,
  lang,
  player,
  answer,
  playing,
  onAnswer,
}: {
  m: ChatMessage;
  lang: Lang;
  player: string;
  /** The player's correct answer to this message's question, once given. */
  answer: string | undefined;
  playing: boolean;
  onAnswer: (questionId: string, value: string) => void;
}) {
  if (m.who === 'system') {
    return (
      <div className="msg sys">
        <span>
          <Md text={m.text[lang]} />
        </span>
      </div>
    );
  }
  const name = m.who === 'you' ? player : npcName(m.who)[lang];
  const mark = m.who === 'you' ? player.trim().charAt(0) || (lang === 'ar' ? 'أ' : 'Y') : TEAM[m.who].mark[lang];
  const questionId = m.questionId;
  return (
    <div className={m.alert ? 'msg alert' : 'msg'} data-who={m.who}>
      <div className="avatar">{mark}</div>
      <div>
        <div className="who">
          {name}
          <time>{clockText(m.minute, lang)}</time>
        </div>
        <div className="text">
          <p>
            <Md text={m.text[lang]} />
          </p>
          {m.url && (
            <span className="url" dir="ltr">
              {m.url}
            </span>
          )}
        </div>
        {m.options && questionId && (
          <div className="opts">
            {m.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={answer === o.value ? 'right' : undefined}
                disabled={!!answer || !playing}
                onClick={() => onAnswer(questionId, o.value)}
              >
                {o.label[lang]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
