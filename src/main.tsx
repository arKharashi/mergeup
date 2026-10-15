import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './game/game';
import { browserStore } from './game/progress';
import { LEVELS } from './levels';
import { App } from './ui/App';
import { GameProvider } from './ui/gameContext';
import { TerminalBuffer } from './ui/terminalBuffer';

const terminal = new TerminalBuffer();
const game = new Game(LEVELS, terminal, browserStore());
if (game.hasPlayer()) game.resume();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameProvider game={game}>
      <App terminal={terminal} />
    </GameProvider>
  </StrictMode>,
);

// Handy while building levels: open the console and call __game.loadLevel(3), __game.run('git log').
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
