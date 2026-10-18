import type { Bilingual, Commit, LocalRepo, Person, PullRequest, PushRejection, RemoteRepo, ReviewComment, ReviewState, Tree, World } from '../engine';
import type { RankId } from './ranks';
import type { NpcId } from './team';

export type Who = NpcId | 'system' | 'you';

/** One answer to pick in the chat. */
export interface Choice {
  /** What `answer`, `right` and `wrong` compare. */
  value: string;
  label: Bilingual;
}

/** A choice that reads the same in both languages, such as a price. */
export const same = (value: string): Choice => ({ value, label: { ar: value, en: value } });

/** A multiple-choice question asked in the team chat. */
export interface Question {
  id: string;
  options: Choice[];
  answer: string;
  /** Runs once the player picks the right answer (e.g. ask the next question). */
  right?(api: LevelApi): void;
  /** Runs on a wrong pick, with the chosen value. The game already takes 2 reputation. */
  wrong?(api: LevelApi, value: string): void;
}

export interface SayOptions {
  /** Shown under the message as selectable text, e.g. the clone URL. */
  url?: string;
  /** Red-tinted message for warnings. */
  alert?: boolean;
  question?: Question;
}

/** What a level's hooks can see and do. */
export interface LevelApi {
  readonly world: World;
  /** The player's name, as they typed it. */
  readonly player: string;
  /** git subcommands that ran successfully in this level, e.g. ran.log. */
  readonly ran: Readonly<Record<string, true>>;
  /** Questions answered correctly: question id -> answer. */
  readonly answers: Readonly<Record<string, string>>;
  /** Scratch space for the level. Set it up in `setup`. */
  readonly data: Record<string, unknown>;
  say(who: Who, text: Bilingual, opts?: SayOptions): void;
  /** A coaching line in the terminal. */
  tip(text: Bilingual): void;
  rep(delta: number, reason: Bilingual): void;
  /** Ends the level as failed, with the reason shown to the player. */
  fail(reason: Bilingual): void;
  /** A teammate reviews a pull request at its current head, as on the code host. */
  review(who: NpcId, pr: PullRequest, state: ReviewState, body: Bilingual, comments?: ReviewComment[]): void;
}

export interface Objective {
  /** Backticks mark `code`. A function when it shows the player's data, such as their name. */
  text: Bilingual | ((api: LevelApi) => Bilingual);
  done(api: LevelApi): boolean;
}

/** What `setup` returns: the starting state of the world. */
export interface LevelStart {
  remote: RemoteRepo;
  /** Omit when the player starts without a clone (level 1). */
  local?: LocalRepo;
  /** Defaults to inside the clone when there is one, else "~". */
  cwd?: string;
  data?: Record<string, unknown>;
}

/**
 * A scripted way to beat the level. Tests play it; it should earn 3 stars.
 * A step is a command line, a chat answer, a saved file, or a click on the code host: open a pull request, merge one.
 */
export type SolutionStep =
  | string
  | { answer: string; value: string }
  | { write: string; content: string }
  | { openPull: string; title: string }
  | { merge: number };

export interface Level {
  id: number;
  rank: RankId;
  title: Bilingual;
  /** One or two sentences under the title. */
  summary: Bilingual;
  setup(player: Person): LevelStart;
  /** The opening chat messages. */
  intro(api: LevelApi): void;
  objectives: Objective[];
  /** Tier 1: a nudge. Tier 2: the commands. Tier 3: the full solution (costs a star). */
  hints: [Bilingual, Bilingual, Bilingual | ((api: LevelApi) => Bilingual)];
  /** The `help` cheat sheet: [command, description]. */
  help: [string, Bilingual][];
  onCommit?(api: LevelApi, commit: Commit, changed: string[], parentTree: Tree): void;
  /** Return 'handled' to skip the game's default reaction to a push. */
  onPush?(api: LevelApi, pushed: Commit[], branch: string): 'handled' | void;
  /** The team's repo turned a push to `branch` down, e.g. a protected `main`. */
  onPushRejected?(api: LevelApi, branch: string, reason: PushRejection): void;
  /** The player opened a pull request on the code host. */
  onPullOpened?(api: LevelApi, pr: PullRequest): void;
  /** The player merged a pull request. */
  onPullMerged?(api: LevelApi, pr: PullRequest): void;
  onComplete?(api: LevelApi): void;
  solution(player: string): SolutionStep[];
}
