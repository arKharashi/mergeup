import './styles.css';
import { startApp } from './ui/app';

const game = startApp();

// Handy while building levels: open the console and call __game.loadLevel(3), __game.run('git log').
if (import.meta.env.DEV) (window as unknown as { __game: typeof game }).__game = game;
