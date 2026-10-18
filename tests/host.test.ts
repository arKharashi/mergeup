import { describe, expect, it } from 'vitest';
import {
  addReview,
  cannotOpen,
  mergePull,
  mergeTrees,
  openPull,
  pullCommits,
  pullConflicts,
  pullFiles,
  reviewDecision,
  type PullRequest,
} from '../src/engine';
import { person } from '../src/game/team';
import { makeWorld } from './helpers';

/** A pushed feature branch with one commit, and an open pull request for it. */
function withPull() {
  const made = makeWorld({ cloned: true });
  const { world, run } = made;
  world.remote.pulls = [];
  run('git switch -c feature/about');
  run('echo about > about.html');
  run('git add about.html');
  run('git commit -m "Add about page"');
  run('git push -u origin feature/about');
  const pr = openPull(world.remote, { head: 'feature/about', base: 'main', title: 'Add the About page', body: '', author: world.me, time: world.now() });
  return { ...made, pr };
}

const review = (pr: PullRequest, who: 'khalid' | 'sara', state: 'approved' | 'changes_requested' | 'commented') =>
  addReview(pr, { by: person(who), state, body: { ar: 'ملاحظة', en: 'A note' }, comments: [], commit: pr.headTip, time: 0 });

describe('pull requests on the host', () => {
  it('opens one per branch, only for a branch with new commits', () => {
    const { world, run, pr } = withPull();
    expect(pr.number).toBe(1);
    expect(cannotOpen(world.remote, 'feature/about', 'main')).toBe('exists');
    expect(cannotOpen(world.remote, 'main', 'main')).toBe('same');
    expect(cannotOpen(world.remote, 'nope', 'main')).toBe('no-branch');
    run('git switch -c feature/empty main');
    run('git push -u origin feature/empty');
    expect(cannotOpen(world.remote, 'feature/empty', 'main')).toBe('no-commits');
  });

  it('lists its commits and files, and a push adds to it', () => {
    const { world, run, pr } = withPull();
    expect(pullCommits(world.remote, pr).map((c) => c.message)).toEqual(['Add about page']);
    expect(pullFiles(world.remote, pr)).toEqual(['about.html']);
    run('echo "const hour = 9;" > about.js');
    run('git add about.js');
    run('git commit -m "Add the opening hour script"');
    run('git push');
    expect(pullCommits(world.remote, pr).map((c) => c.message)).toEqual(['Add about page', 'Add the opening hour script']);
    expect(pr.events.at(-1)).toMatchObject({ kind: 'push', commits: [world.remote.branches['feature/about']] });
    expect(pullFiles(world.remote, pr)).toEqual(['about.html', 'about.js']);
  });

  it('decides reviews by each reviewer’s latest state', () => {
    const { pr } = withPull();
    expect(reviewDecision(pr)).toBe('review_required');
    review(pr, 'khalid', 'changes_requested');
    expect(reviewDecision(pr)).toBe('changes_requested');
    review(pr, 'khalid', 'commented');
    expect(reviewDecision(pr)).toBe('changes_requested');
    review(pr, 'khalid', 'approved');
    expect(reviewDecision(pr)).toBe('approved');
    review(pr, 'sara', 'changes_requested');
    expect(reviewDecision(pr)).toBe('changes_requested');
  });

  it('merges with a merge commit on the base branch', () => {
    const { world, pr } = withPull();
    const main = world.remote.branches.main!;
    const head = world.remote.branches['feature/about']!;
    const c = mergePull(world.remote, pr, person('khalid'), world.now());
    expect(Array.isArray(c)).toBe(false);
    if (Array.isArray(c)) return;
    expect(c.parents).toEqual([main, head]);
    expect(c.message).toBe('Merge pull request #1 from team/feature/about\n\nAdd the About page');
    expect(world.remote.branches.main).toBe(c.id);
    expect(c.tree['about.html']).toBe('about\n');
    expect(pr.state).toBe('merged');
    // Still lists what it brought in, now that main has it.
    expect(pullCommits(world.remote, pr).map((x) => x.message)).toEqual(['Add about page']);
    expect(pullFiles(world.remote, pr)).toEqual(['about.html']);
  });

  it('refuses to merge a file both sides changed', () => {
    const { world, pr } = withPull();
    const tip = world.remote.branches.main!;
    const mainTree = { ...world.remote.commits[tip]!.tree, 'about.html': 'other\n' };
    const theirs = { ...world.remote.commits[tip]!, id: 'f'.repeat(40), tree: mainTree, parents: [tip], message: 'Add another about page' };
    world.remote.commits[theirs.id] = theirs;
    world.remote.branches.main = theirs.id;
    expect(pullConflicts(world.remote, pr)).toEqual(['about.html']);
    expect(mergePull(world.remote, pr, person('khalid'), 0)).toEqual(['about.html']);
    expect(pr.state).toBe('open');
  });
});

describe('mergeTrees', () => {
  it('takes each side’s own changes and flags files changed on both', () => {
    const base = { a: '1', b: '1', c: '1' };
    const ours = { a: '2', b: '1', c: '1', d: 'new' };
    const theirs = { a: '1', b: '3', e: 'theirs' };
    expect(mergeTrees(base, ours, theirs)).toEqual({ tree: { a: '2', b: '3', d: 'new', e: 'theirs' }, conflicts: [] });
    expect(mergeTrees(base, { ...ours, b: '2' }, theirs).conflicts).toEqual(['b']);
  });
});
