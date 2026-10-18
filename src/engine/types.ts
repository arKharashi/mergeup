import type { PullRequest } from './host';

/** File path -> file content. Paths are flat (no folders yet), e.g. "README.md". */
export type Tree = Record<string, string>;

export interface Person {
  name: string;
  email: string;
}

export interface Commit {
  id: string;
  tree: Tree;
  message: string;
  author: Person;
  /** Milliseconds since epoch. */
  time: number;
  /** [] for the first commit, [parent] normally, [ours, theirs] for a merge commit. */
  parents: string[];
}

/** The team's shared repository ("origin") on the fictional host repo.bun.local. */
export interface RemoteRepo {
  url: string;
  commits: Record<string, Commit>;
  /** branch name -> commit id */
  branches: Record<string, string>;
  /** The branch origin/HEAD points to. */
  defaultBranch: string;
  /** Branches that refuse direct pushes (Junior rank: "work through a PR"). */
  protectedBranches: string[];
  /** Pull requests on the code host. Absent until a level turns the host's pull requests on. */
  pulls?: PullRequest[];
}

export type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string };

/** The player's clone on their own machine. */
export interface LocalRepo {
  /** Folder name under ~, e.g. "bun-cafe". */
  dir: string;
  url: string;
  commits: Record<string, Commit>;
  head: Head;
  /** Local branches: name -> commit id. */
  branches: Record<string, string>;
  /** Remote-tracking branches as last fetched: "main" means origin/main. */
  remoteBranches: Record<string, string>;
  /** What origin/HEAD points to. */
  remoteHead: string;
  /** Local branch -> the remote branch it tracks. */
  upstream: Record<string, string>;
  /** The branch HEAD was on before the last switch, for `git switch -`. */
  previous?: string;
  /** The staging area. */
  index: Tree;
  /** Files on disk. */
  work: Tree;
}

/** Everything a command can see and change. */
export interface World {
  remote: RemoteRepo;
  local: LocalRepo | null;
  /** "~" or "~/<dir>". */
  cwd: string;
  me: Person;
  now: () => number;
}

export type FileState = 'staged' | 'modified' | 'untracked' | 'ignored';

export interface StatusEntry {
  path: string;
  kind: 'new file' | 'modified' | 'deleted';
}

export interface Status {
  staged: StatusEntry[];
  unstaged: StatusEntry[];
  untracked: string[];
}
