import {
  computeStatus,
  headBranch,
  headTree,
  inRepo,
  isIgnored,
  isWeakMessage,
  runLine,
  GIT_SUBCOMMANDS,
  SHELL_COMMANDS,
  type Commit,
  type Ctx,
  type Out,
  type World,
} from '../engine';
import type { Level, LevelApi, Question, SayOptions, Who } from './level';
import { clamp, saveProgress, type KeyValueStore, type Progress, loadProgress } from './progress';
import { lockedUntil, rankOfLevel, type Rank } from './ranks';

export interface ChatMessage {
  seq: number;
  who: Who;
  text: string;
  url?: string;
  alert?: boolean;
  questionId?: string;
  options?: string[];
  /** Minutes since 9:00 on the level's workday. */
  minute: number;
}

export interface Session {
  /** Increments with every level load, so the UI can drop stale timers. */
  id: number;
  level: Level;
  world: World;
  ran: Record<string, true>;
  answers: Record<string, string>;
  questions: Record<string, Question>;
  chat: ChatMessage[];
  minute: number;
  hintTier: number;
  repLost: boolean;
  usedSolution: boolean;
  status: 'playing' | 'done' | 'failed';
  data: Record<string, unknown>;
  pushRewarded: boolean;
}

export interface GameEvents {
  session: Session;
  chat: ChatMessage;
  change: undefined;
  rep: { delta: number; reason: string; total: number };
  complete: { session: Session; stars: number; promotedTo: Rank | null };
  fail: { session: Session; reason: string };
}

export type BadgeKind = 'staged' | 'modified' | 'untracked' | 'ignored';
export interface FileEntry {
  path: string;
  badge: { code: string; kind: BadgeKind; title: string } | null;
}

type Listener<T> = (payload: T) => void;

export const PLAYER_EMAIL = 'you@bun.team';
const LOW_REP = 30;

export class Game {
  progress: Progress;
  session: Session | null = null;
  private listeners: { [K in keyof GameEvents]?: Listener<GameEvents[K]>[] } = {};
  private seq = 0;
  private sessions = 0;
  private readonly now: () => number;

  constructor(
    readonly levels: Level[],
    private readonly out: Out,
    private readonly store: KeyValueStore,
    opts: { now?: () => number } = {},
  ) {
    this.progress = loadProgress(store);
    this.now = opts.now ?? (() => Date.now());
  }

  /* ---------------- events ---------------- */

  on<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): () => void {
    const list = (this.listeners[event] ??= []) as Listener<GameEvents[K]>[];
    list.push(fn);
    return () => list.splice(list.indexOf(fn), 1);
  }

  private emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    for (const fn of (this.listeners[event] ?? []) as Listener<GameEvents[K]>[]) fn(payload);
  }

  /* ---------------- player & progress ---------------- */

  get player(): string {
    return this.progress.name;
  }

  hasPlayer(): boolean {
    return !!this.progress.name;
  }

  setPlayerName(name: string): void {
    this.progress.name = name.trim().replace(/\s+/g, ' ').slice(0, 24);
    this.save();
  }

  private save(): void {
    saveProgress(this.store, this.progress);
  }

  /** The rank the player holds, from the highest level they unlocked. */
  playerRank(): Rank {
    return rankOfLevel(Math.min(this.progress.unlocked, this.levels.length + 1));
  }

  isBuilt(n: number): boolean {
    return n >= 1 && n <= this.levels.length;
  }

  canOpen(n: number): boolean {
    return this.isBuilt(n) && n <= this.progress.unlocked;
  }

  /** Opens the level the player was last on. */
  resume(): void {
    const n = Math.min(this.progress.level, this.progress.unlocked, this.levels.length);
    this.loadLevel(Math.max(1, n));
  }

  /* ---------------- levels ---------------- */

  loadLevel(n: number): void {
    const level = this.levels[n - 1];
    if (!level) throw new Error('No level ' + n);
    const me = { name: this.progress.name, email: PLAYER_EMAIL };
    const start = level.setup(me);
    const world: World = {
      remote: start.remote,
      local: start.local ?? null,
      cwd: start.cwd ?? (start.local ? '~/' + start.local.dir : '~'),
      me,
      now: this.now,
    };
    const s: Session = {
      id: ++this.sessions,
      level,
      world,
      ran: {},
      answers: {},
      questions: {},
      chat: [],
      minute: 0,
      hintTier: 0,
      repLost: false,
      usedSolution: false,
      status: 'playing',
      data: start.data ?? {},
      pushRewarded: false,
    };
    this.session = s;
    this.progress.level = n;
    this.save();

    this.out.clear();
    this.out.print('bun-cafe · Level ' + n + ' · ' + level.title, 'd');
    if (n === 1) this.out.tip('هذي طرفية اللعبة. اكتب الأوامر واضغط Enter، وابدأ بـ `help` لو تبي تشوف الأوامر.');
    else if (world.local) this.out.tip('المشروع جاهز في `~/' + world.local.dir + '` وأنت داخله.');
    this.out.print('');

    this.emit('session', s);
    level.intro(this.api(s));
    this.emit('change', undefined);
  }

  /** The object level hooks receive. */
  private api(s: Session): LevelApi {
    return {
      world: s.world,
      player: this.progress.name,
      ran: s.ran,
      answers: s.answers,
      data: s.data,
      say: (who, text, opts) => this.say(s, who, text, opts),
      tip: (text) => this.out.tip(text),
      rep: (delta, reason) => this.rep(s, delta, reason),
      fail: (reason) => this.fail(s, reason),
    };
  }

  private say(s: Session, who: Who, text: string, opts: SayOptions = {}): void {
    if (who !== 'system' && who !== 'you') s.minute += 1 + Math.floor(text.length / 90);
    const msg: ChatMessage = { seq: ++this.seq, who, text, minute: s.minute };
    if (opts.url) msg.url = opts.url;
    if (opts.alert) msg.alert = true;
    if (opts.question) {
      s.questions[opts.question.id] = opts.question;
      msg.questionId = opts.question.id;
      msg.options = opts.question.options;
    }
    s.chat.push(msg);
    this.emit('chat', msg);
  }

  private rep(s: Session, delta: number, reason: string): void {
    const before = this.progress.rep;
    this.progress.rep = clamp(before + delta, 0, 100);
    if (delta < 0) s.repLost = true;
    this.save();
    this.emit('rep', { delta, reason, total: this.progress.rep });
    if (before >= LOW_REP && this.progress.rep < LOW_REP) {
      this.say(
        s,
        'abufahd',
        'تعال مكتبي دقيقة يا ' + this.progress.name + '. الأخطاء بدأت تتكرر وسمعتك عند الفريق نزلت. ' +
          'اقرأ تلميحات المهمة، ولو احتجت ابدأ المستوى من جديد بـ «رجّع الوقت». كلنا غلطنا في بدايتنا.',
      );
    }
  }

  private fail(s: Session, reason: string): void {
    if (s.status !== 'playing') return;
    s.status = 'failed';
    this.emit('fail', { session: s, reason });
  }

  /* ---------------- player actions ---------------- */

  run(line: string): void {
    const s = this.session;
    if (!s) return;
    const api = this.api(s);
    const ctx: Ctx = {
      world: s.world,
      out: this.out,
      ran: s.ran,
      help: s.level.help,
      lockedUntil: (feature) => lockedUntil(feature, s.level.rank),
      hooks: {
        onCommit: (c, changed, parentTree) => s.level.onCommit?.(api, c, changed, parentTree),
        onPush: (pushed, branch) => this.onPush(s, api, pushed, branch),
      },
    };
    runLine(ctx, line);
    this.check(s);
    this.emit('change', undefined);
  }

  /** The team's default reaction to a push: reputation for commit messages. */
  private onPush(s: Session, api: LevelApi, pushed: Commit[], branch: string): void {
    if (s.level.onPush?.(api, pushed, branch) === 'handled') return;
    if (s.status !== 'playing') return;
    const weak = pushed.filter((c) => isWeakMessage(c.message));
    if (weak.length) {
      this.rep(s, -Math.min(10, 5 * weak.length), 'رسالة commit غير واضحة');
      const m = weak[0]!.message.split('\n')[0];
      this.say(
        s,
        'abufahd',
        'شفت شغلك، شكراً. بس رسالة الـ commit `' + m + '` ما توضح وش تغيّر، وبعد شهر محد بيتذكر. ' +
          'اكتب وش سويت بالضبط، مثل: `Add karak tea to the menu`',
      );
    } else if (pushed.length && !s.pushRewarded) {
      s.pushRewarded = true;
      this.rep(s, 3, 'رفعت شغل برسائل واضحة');
    }
  }

  answer(questionId: string, value: string): void {
    const s = this.session;
    const q = s?.questions[questionId];
    if (!s || !q || s.answers[questionId] || s.status !== 'playing') return;
    const api = this.api(s);
    this.say(s, 'you', value);
    if (value === q.answer) {
      s.answers[questionId] = value;
      q.right?.(api);
    } else {
      this.rep(s, -2, 'إجابة غلط في الشات');
      q.wrong?.(api, value);
    }
    this.check(s);
    this.emit('change', undefined);
  }

  revealHint(): void {
    const s = this.session;
    if (!s || s.hintTier >= 3) return;
    s.hintTier++;
    if (s.hintTier === 3) s.usedSolution = true;
    this.emit('change', undefined);
  }

  hints(): string[] {
    const s = this.session;
    if (!s) return [];
    const api = this.api(s);
    return s.level.hints.slice(0, s.hintTier).map((h) => (typeof h === 'function' ? h(api) : h));
  }

  objectives(): { text: string; done: boolean }[] {
    const s = this.session;
    if (!s) return [];
    const api = this.api(s);
    return s.level.objectives.map((o) => ({ text: o.text, done: o.done(api) }));
  }

  private check(s: Session): void {
    if (s.status !== 'playing') return;
    const api = this.api(s);
    if (!s.level.objectives.every((o) => o.done(api))) return;

    s.status = 'done';
    const stars = 1 + (s.repLost ? 0 : 1) + (s.usedSolution ? 0 : 1);
    const id = s.level.id;
    const rankBefore = this.playerRank();
    this.progress.stars[id] = Math.max(this.progress.stars[id] ?? 0, stars);
    this.progress.unlocked = Math.max(this.progress.unlocked, id + 1);
    this.save();
    const rankAfter = this.playerRank();
    s.level.onComplete?.(api);
    this.emit('complete', { session: s, stars, promotedTo: rankAfter.id !== rankBefore.id ? rankAfter : null });
  }

  /* ---------------- files panel ---------------- */

  files(): FileEntry[] {
    const L = this.session?.world.local;
    if (!L) return [];
    const head = headTree(L);
    return Object.keys(L.work)
      .sort((a, b) => Number(a.startsWith('.')) - Number(b.startsWith('.')) || a.localeCompare(b))
      .map((path): FileEntry => {
        if (!(path in L.index)) {
          return isIgnored(path, L.work['.gitignore'])
            ? { path, badge: { code: '!', kind: 'ignored', title: 'متجاهَل في .gitignore' } }
            : { path, badge: { code: 'U', kind: 'untracked', title: 'ملف جديد ما يعرفه git' } };
        }
        if (L.work[path] !== L.index[path]) return { path, badge: { code: 'M', kind: 'modified', title: 'تعديل ما جهّزته' } };
        if (L.index[path] !== head[path]) {
          return { path, badge: { code: path in head ? 'M' : 'A', kind: 'staged', title: 'جاهز للـ commit' } };
        }
        return { path, badge: null };
      });
  }

  readFile(path: string): string | undefined {
    return this.session?.world.local?.work[path];
  }

  writeFile(path: string, content: string): void {
    const s = this.session;
    const L = s?.world.local;
    if (!s || !L || !(path in L.work)) return;
    L.work[path] = content === '' || content.endsWith('\n') ? content : content + '\n';
    this.check(s);
    this.emit('change', undefined);
  }

  createFile(path: string): boolean {
    const s = this.session;
    const L = s?.world.local;
    if (!s || !L || !/^[\w.-]+$/.test(path)) return false;
    if (!(path in L.work)) L.work[path] = '';
    this.check(s);
    this.emit('change', undefined);
    return true;
  }

  /* ---------------- terminal helpers ---------------- */

  prompt(): { user: string; path: string; branch: string } {
    const w = this.session?.world;
    if (!w) return { user: 'dev@bun', path: '~', branch: '' };
    const b = w.local && inRepo(w) ? headBranch(w.local) : null;
    return { user: 'dev@bun', path: w.cwd, branch: b ? ' (' + b + ')' : '' };
  }

  /** Tab completion candidates for the word being typed. */
  completions(words: string[]): string[] {
    const w = this.session?.world;
    if (!w) return [];
    if (words.length <= 1) return SHELL_COMMANDS;
    if (words.length === 2 && words[0] === 'git') return GIT_SUBCOMMANDS;
    if (w.local && inRepo(w)) return Object.keys(w.local.work);
    return w.local ? [w.local.dir + '/'] : [];
  }

  /** True when there is nothing uncommitted (used by levels and tests). */
  isClean(): boolean {
    const L = this.session?.world.local;
    if (!L) return true;
    const st = computeStatus(L);
    return !st.staged.length && !st.unstaged.length && !st.untracked.length;
  }
}
