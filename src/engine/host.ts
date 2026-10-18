import { treeDiff } from './diff';
import { walkCommits } from './git/graph';
import type { Bilingual } from './output';
import { ancestors, makeCommit } from './repo';
import type { Commit, Person, RemoteRepo, Tree } from './types';

/**
 * The team's code host, repo.bun.local: pull requests on the shared repository.
 * It records what happened (opened, reviewed, pushed to, merged); who reviews and what CI checks are game rules.
 */

/** A note on one line of a file in a review. */
export interface ReviewComment {
  path: string;
  /** 1-based, in the file as it was at the reviewed commit. */
  line: number;
  body: Bilingual;
}

export type ReviewState = 'approved' | 'changes_requested' | 'commented';

export interface Review {
  by: Person;
  state: ReviewState;
  body: Bilingual;
  comments: ReviewComment[];
  /** The head commit the review looked at. */
  commit: string;
  time: number;
}

export type PullEvent =
  | { kind: 'review'; review: Review }
  /** New commits pushed to the head branch while the pull request was open, oldest first. */
  | { kind: 'push'; commits: string[]; time: number }
  | { kind: 'merged'; by: Person; commit: string; time: number };

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  author: Person;
  /** The branch with the work, and the branch it goes into. */
  head: string;
  base: string;
  state: 'open' | 'merged';
  time: number;
  /** The head branch's commit when last seen: at opening, after each push, and when merged. */
  headTip: string;
  events: PullEvent[];
}

const OWNER = 'team';

/** The open pull request for `head`, if any. */
export const openPullFor = (remote: RemoteRepo, head: string): PullRequest | undefined =>
  remote.pulls?.find((p) => p.state === 'open' && p.head === head);

/** The commit two lines of history last shared: the first of `b`'s ancestors, newest first, that `a` also has. */
export function mergeBase(commits: Record<string, Commit>, a: string, b: string): string | null {
  const inA = ancestors(commits, a);
  return walkCommits(commits, [b], new Set(), false).find((c) => inA.has(c.id))?.id ?? null;
}

/** The pull request's head tip, and the base tip it is compared with (before the merge, once merged). */
function pullRefs(remote: RemoteRepo, pr: PullRequest): { tip: string; baseTip: string } {
  const merge = pr.events.find((e) => e.kind === 'merged');
  return {
    tip: pr.state === 'open' ? (remote.branches[pr.head] ?? pr.headTip) : pr.headTip,
    baseTip: merge ? remote.commits[merge.commit]!.parents[0]! : remote.branches[pr.base]!,
  };
}

/** What `tip` brings that `baseTip` doesn't have: its commits (oldest first), and the trees to diff. */
export function compare(remote: RemoteRepo, baseTip: string, tip: string): { commits: Commit[]; base: Tree; head: Tree } {
  const at = mergeBase(remote.commits, baseTip, tip);
  return {
    commits: walkCommits(remote.commits, [tip], ancestors(remote.commits, baseTip), false).reverse(),
    base: at ? remote.commits[at]!.tree : {},
    head: remote.commits[tip]!.tree,
  };
}

/** Commits on the pull request's head that its base doesn't have, oldest first. */
export function pullCommits(remote: RemoteRepo, pr: PullRequest): Commit[] {
  const { tip, baseTip } = pullRefs(remote, pr);
  return compare(remote, baseTip, tip).commits;
}

/** The trees a pull request compares: where the head branched off, and its tip. */
export function pullTrees(remote: RemoteRepo, pr: PullRequest): { base: Tree; head: Tree } {
  const { tip, baseTip } = pullRefs(remote, pr);
  const { base, head } = compare(remote, baseTip, tip);
  return { base, head };
}

/** Files the pull request changes. */
export function pullFiles(remote: RemoteRepo, pr: PullRequest): string[] {
  const { base, head } = pullTrees(remote, pr);
  return treeDiff(base, head);
}

/** Why a pull request can't be opened, or null. */
export function cannotOpen(remote: RemoteRepo, head: string, base: string): 'no-branch' | 'same' | 'no-commits' | 'exists' | null {
  if (!remote.branches[head] || !remote.branches[base]) return 'no-branch';
  if (head === base) return 'same';
  if (openPullFor(remote, head)) return 'exists';
  if (ancestors(remote.commits, remote.branches[base]).has(remote.branches[head]!)) return 'no-commits';
  return null;
}

export function openPull(remote: RemoteRepo, fields: { head: string; base: string; title: string; body: string; author: Person; time: number }): PullRequest {
  const pulls = (remote.pulls ??= []);
  const pr: PullRequest = {
    number: pulls.length + 1,
    ...fields,
    state: 'open',
    headTip: remote.branches[fields.head]!,
    events: [],
  };
  pulls.push(pr);
  return pr;
}

/** Records a push to a pull request's head branch. Call after the remote branch moved. */
export function notePush(remote: RemoteRepo, pr: PullRequest, time: number): void {
  const tip = remote.branches[pr.head];
  if (!tip || tip === pr.headTip) return;
  const fresh = walkCommits(remote.commits, [tip], ancestors(remote.commits, pr.headTip), false).reverse();
  pr.headTip = tip;
  pr.events.push({ kind: 'push', commits: fresh.map((c) => c.id), time });
}

export function addReview(pr: PullRequest, review: Review): void {
  pr.events.push({ kind: 'review', review });
}

/** The latest review state of each reviewer, by email. */
export function latestReviews(pr: PullRequest): Map<string, Review> {
  const latest = new Map<string, Review>();
  for (const e of pr.events) if (e.kind === 'review' && e.review.state !== 'commented') latest.set(e.review.by.email, e.review);
  return latest;
}

/** Approved when someone approved and nobody's latest review asks for changes. */
export function reviewDecision(pr: PullRequest): 'approved' | 'changes_requested' | 'review_required' {
  const states = [...latestReviews(pr).values()].map((r) => r.state);
  if (states.includes('changes_requested')) return 'changes_requested';
  return states.includes('approved') ? 'approved' : 'review_required';
}

/**
 * Three-way merge of whole files: a file changed on one side only takes that side.
 * A file changed differently on both sides is a conflict (line-level merging comes with `git merge`).
 */
export function mergeTrees(base: Tree, ours: Tree, theirs: Tree): { tree: Tree; conflicts: string[] } {
  const tree: Tree = { ...ours };
  const conflicts: string[] = [];
  for (const p of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const [b, o, t] = [base[p], ours[p], theirs[p]];
    if (o === t || t === b) continue;
    if (o === b) {
      if (t === undefined) delete tree[p];
      else tree[p] = t;
    } else conflicts.push(p);
  }
  return { tree, conflicts: conflicts.sort() };
}

/** Files that would conflict if the pull request were merged now. */
export function pullConflicts(remote: RemoteRepo, pr: PullRequest): string[] {
  if (pr.state !== 'open') return [];
  const ours = remote.branches[pr.base]!;
  const theirs = remote.branches[pr.head]!;
  const at = mergeBase(remote.commits, ours, theirs);
  const t = (id: string | null) => (id ? remote.commits[id]!.tree : {});
  return mergeTrees(t(at), t(ours), t(theirs)).conflicts;
}

/**
 * Merges the pull request with a merge commit, the way the host's "Merge pull request" button does.
 * Returns the merge commit, or the conflicting files.
 */
export function mergePull(remote: RemoteRepo, pr: PullRequest, by: Person, time: number): Commit | string[] {
  const ours = remote.branches[pr.base]!;
  const theirs = remote.branches[pr.head]!;
  const at = mergeBase(remote.commits, ours, theirs);
  const t = (id: string | null) => (id ? remote.commits[id]!.tree : {});
  const { tree, conflicts } = mergeTrees(t(at), t(ours), t(theirs));
  if (conflicts.length) return conflicts;
  const message = 'Merge pull request #' + pr.number + ' from ' + OWNER + '/' + pr.head + '\n\n' + pr.title;
  const c = makeCommit({ tree, message, author: by, time, parents: [ours, theirs] });
  remote.commits[c.id] = c;
  remote.branches[pr.base] = c.id;
  pr.state = 'merged';
  pr.headTip = theirs;
  pr.events.push({ kind: 'merged', by, commit: c.id, time });
  return c;
}
