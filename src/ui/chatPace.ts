import { useEffect, useEffectEvent, useState } from 'react';
import type { ChatMessage, Session } from '../game/game';
import type { Who } from '../game/level';
import type { NpcId } from '../game/team';
import { reducedMotion } from './dom';

/** Teammates "type" before their message appears; the system and the player don't. */
export const isPerson = (who: Who): who is NpcId => who !== 'system' && who !== 'you';

function typingDelay(m: ChatMessage): number {
  if (reducedMotion()) return 60;
  return isPerson(m.who) ? Math.min(1500, 450 + m.text.ar.length * 9) : 120;
}

/**
 * How many of the session's chat messages are on screen. The game already holds the final chat;
 * this only paces the display, one message at a time, so NPCs feel like people.
 * Starts from zero on every new session. `onArrive` runs as each message appears.
 */
export function useChatPace(session: Session | null, onArrive: (m: ChatMessage) => void): number {
  const id = session?.id ?? 0;
  const [pace, setPace] = useState({ id, shown: 0 });
  const shown = pace.id === id ? pace.shown : 0;
  const next = session?.chat[shown];
  const arrive = useEffectEvent(onArrive);

  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => {
      setPace({ id, shown: shown + 1 });
      arrive(next);
    }, typingDelay(next));
    return () => clearTimeout(t);
  }, [id, shown, next]);

  return shown;
}
