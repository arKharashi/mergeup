import { Game } from '../game/game';
import { browserStore } from '../game/progress';
import { LEVELS } from '../levels';
import { ChatView } from './chat';
import { $, reducedMotion, sleep } from './dom';
import { FilesView } from './files';
import { HeaderView } from './header';
import { Overlays } from './overlays';
import { Panes } from './panes';
import { TaskView } from './task';
import { TerminalView } from './terminal';
import { repToast } from './toasts';

/** Wires the game to the page. */
export function startApp(): Game {
  const terminal = new TerminalView();
  const game = new Game(LEVELS, terminal, browserStore());
  terminal.attach(game);

  const chat = new ChatView(game);
  const task = new TaskView(game);
  const files = new FilesView(game);
  const header = new HeaderView(game);
  const overlays = new Overlays(game);
  const panes = new Panes();

  const renderAll = () => {
    header.render();
    task.render();
    files.render();
    chat.refresh();
    terminal.renderPrompt();
  };

  const load = (n: number, keepPane = false) => {
    game.loadLevel(n);
    if (!keepPane) panes.show(panes.defaultPane());
  };

  game.on('session', () => {
    chat.reset();
    files.reset();
  });
  game.on('chat', (m) => chat.push(m));
  game.on('change', renderAll);
  game.on('rep', (e) => repToast(e.delta, e.reason));

  // Wait for the chat to finish "typing" so the team's reaction is read before the card.
  game.on('complete', async ({ session, stars, promotedTo }) => {
    await chat.whenIdle();
    await sleep(reducedMotion() ? 200 : 900);
    if (game.session !== session) return;
    overlays.complete(session, stars, promotedTo, {
      next: () => load(session.level.id + 1),
      replay: () => load(session.level.id, true),
    });
  });
  game.on('fail', async ({ session, reason }) => {
    await chat.whenIdle();
    await sleep(reducedMotion() ? 200 : 900);
    if (game.session !== session) return;
    overlays.fail(reason, { retry: () => load(session.level.id, true) });
  });

  chat.onArrive = () => panes.mark('team');
  panes.onShow = (pane) => {
    if (pane === 'term' && panes.isWide) terminal.focus();
    if (pane === 'term') terminal.scrollToEnd();
  };
  header.onPickLevel = (n) => {
    const s = game.session;
    if (s && s.status === 'playing' && Object.keys(s.ran).length) {
      overlays.confirm('تنتقل للمستوى ' + n + '؟', 'شغلك في المستوى الحالي بيرجع لبدايته.', 'انتقل', () => load(n));
    } else load(n);
  };
  $('#rewind').addEventListener('click', () => {
    const s = game.session;
    if (!s) return;
    overlays.confirm(
      'ترجّع المستوى لبدايته؟',
      'المشروع والشات يرجعون مثل أول ما بدأت المستوى. سمعتك ونجومك السابقة تبقى مثل ما هي.',
      'رجّع الوقت',
      () => load(s.level.id, true),
    );
  });

  if (game.hasPlayer()) {
    game.resume();
    panes.show(panes.defaultPane());
  } else {
    renderAll();
    overlays.welcome((name) => {
      game.setPlayerName(name);
      load(1);
    });
  }
  return game;
}
