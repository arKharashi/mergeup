import { useEffect, useRef, useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { isPerson, useChatPace } from './chatPace';
import { reducedMotion } from './dom';
import { FilesPanel } from './FilesPanel';
import { useGame, useGameEvent } from './gameContext';
import { Header } from './Header';
import { useLang } from './lang';
import { Modals, type Modal } from './Modals';
import { defaultPane, isVisible, isWide, type Pane } from './panes';
import { RepoPage } from './RepoPage';
import { Tabs } from './Tabs';
import { TaskCard } from './TaskCard';
import { Terminal, type TerminalHandle } from './Terminal';
import type { TerminalBuffer } from './terminalBuffer';
import { Toasts } from './Toasts';

type Outcome = Extract<Modal, { kind: 'complete' | 'fail' }>;

/** The office: header, the three panes, and the cards and toasts on top. */
export function App({ terminal }: { terminal: TerminalBuffer }) {
  const game = useGame();
  const { t } = useLang();
  const session = game.session;
  // A new object on every show, so showing the terminal again focuses it again.
  const [view, setView] = useState<{ pane: Pane }>(() => ({ pane: game.hasPlayer() ? defaultPane() : 'team' }));
  const [dots, setDots] = useState<ReadonlySet<Pane>>(() => new Set());
  const [modal, setModal] = useState<Modal | null>(() => (game.hasPlayer() ? null : { kind: 'welcome' }));
  // A finished level waits here until the chat has shown the team's reaction.
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const term = useRef<TerminalHandle>(null);

  const showPane = (pane: Pane) => {
    setView({ pane });
    setDots((d) => {
      if (!d.has(pane)) return d;
      const next = new Set(d);
      next.delete(pane);
      return next;
    });
  };

  const dot = (pane: Pane) => setDots((d) => (d.has(pane) ? d : new Set(d).add(pane)));
  const shown = useChatPace(session, (m) => {
    if (isPerson(m.who) && !isVisible('team', view.pane)) dot('team');
  });

  // News on the pull request page (a review, a merge) while it's out of sight.
  const pulls = game.pulls();
  const activity = pulls?.reduce((n, p) => n + p.events.length + 1, 0) ?? 0;
  const seen = useRef(activity);
  useEffect(() => {
    if (activity > seen.current && !isVisible('web', view.pane)) dot('web');
    seen.current = activity;
  }, [activity, view.pane]);

  useEffect(() => {
    if (view.pane !== 'term') return;
    if (isWide()) term.current?.focus();
    term.current?.scrollToEnd();
  }, [view]);

  // Closing a card hands the keyboard back to the command line, where the player left it.
  const hadModal = useRef(false);
  useEffect(() => {
    if (modal) hadModal.current = true;
    else if (hadModal.current) {
      hadModal.current = false;
      if (view.pane === 'term' && isWide()) term.current?.focus();
    }
  }, [modal]);

  useGameEvent('complete', (e) => setOutcome({ kind: 'complete', ...e }));
  useGameEvent('fail', ({ session, reason }) => setOutcome({ kind: 'fail', session, reason }));
  const chatIdle = shown >= (session?.chat.length ?? 0);
  useEffect(() => {
    if (!outcome || !chatIdle) return;
    const t = setTimeout(
      () => {
        setOutcome(null);
        if (game.session === outcome.session) setModal(outcome);
      },
      reducedMotion() ? 200 : 900,
    );
    return () => clearTimeout(t);
  }, [outcome, chatIdle, game]);

  const load = (n: number, keepPane = false) => {
    setOutcome(null);
    game.loadLevel(n);
    if (!keepPane) showPane(defaultPane());
  };

  const pickLevel = (n: number) => {
    const s = game.session;
    if (s && s.status === 'playing' && Object.keys(s.ran).length) {
      setModal({
        kind: 'confirm',
        title: { ar: 'تنتقل للمستوى ' + n + '؟', en: 'Go to level ' + n + '?' },
        text: { ar: 'شغلك في المستوى الحالي بيرجع لبدايته.', en: 'Your work in this level will be reset.' },
        ok: { ar: 'انتقل', en: 'Go' },
        onOk: () => load(n),
      });
    } else load(n);
  };

  const rewind = () => {
    const s = game.session;
    if (!s) return;
    setModal({
      kind: 'confirm',
      title: { ar: 'ترجّع المستوى لبدايته؟', en: 'Restart this level?' },
      text: {
        ar: 'المشروع والشات يرجعون مثل أول ما بدأت المستوى. سمعتك ونجومك السابقة تبقى مثل ما هي.',
        en: 'The project and the chat go back to how they were when the level started. Your reputation and earned stars stay as they are.',
      },
      ok: { ar: 'رجّع الوقت', en: 'Rewind' },
      onOk: () => load(s.level.id, true),
    });
  };

  // Panels with per-level state start fresh when a level loads.
  const sid = session?.id ?? 0;
  const next = session && game.isBuilt(session.level.id + 1) ? session.level.id + 1 : null;
  return (
    <>
      {/* Behind a card, the office can't be focused or clicked, and screen readers skip it. */}
      <div className="app" inert={!!modal}>
        <Header onPickLevel={pickLevel} />
        <Tabs current={view.pane} dots={dots} web={!!pulls} onShow={showPane} />
        <main className="desk" id="desk" data-pane={view.pane}>
          <section className="col col-team" aria-label={t({ ar: 'المهمة والفريق', en: 'Task and team' })}>
            <TaskCard key={sid} onRewind={rewind} onNext={next ? () => load(next) : null} />
            <ChatPanel shown={shown} />
          </section>
          <Terminal ref={term} buffer={terminal} onRewind={rewind} />
          {pulls && <RepoPage key={'pr' + sid} />}
          <FilesPanel key={sid} />
        </main>
      </div>
      <Modals
        modal={modal}
        onClose={() => setModal(null)}
        onStart={(name) => {
          game.setPlayerName(name);
          load(1);
        }}
        onLoad={load}
      />
      <Toasts />
    </>
  );
}
