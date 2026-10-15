import { createContext, use, useEffect, useEffectEvent, useSyncExternalStore, type ReactNode } from 'react';
import type { Game, GameEvents } from '../game/game';

const GameContext = createContext<Game | null>(null);

export function GameProvider({ game, children }: { game: Game; children: ReactNode }) {
  return <GameContext value={game}>{children}</GameContext>;
}

function useGameInstance(): Game {
  const game = use(GameContext);
  if (!game) throw new Error('useGame needs a <GameProvider> above it');
  return game;
}

/** The game. The component renders again after every game event, and reads what it needs from the game. */
export function useGame(): Game {
  const game = useGameInstance();
  useSyncExternalStore(game.subscribe, game.getVersion);
  return game;
}

/** Runs `fn` on one game event, for one-off reactions such as a toast. */
export function useGameEvent<K extends keyof GameEvents>(event: K, fn: (payload: GameEvents[K]) => void): void {
  const game = useGameInstance();
  const onEvent = useEffectEvent(fn);
  useEffect(() => game.on(event, (payload) => onEvent(payload)), [game, event]);
}
