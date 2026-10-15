import { describe, expect, it } from 'vitest';
import { computeStatus, headId, headTree, tokenize } from '../src/engine';
import { REPO_URL, README_V2 } from '../src/levels/fixtures';
import { makeWorld } from './helpers';

describe('shell', () => {
  it('tokenizes quotes, redirects and chains', () => {
    expect(tokenize('git commit -m "Add karak tea"')).toEqual(['git', 'commit', '-m', 'Add karak tea']);
    expect(tokenize("echo '.env'>>.gitignore && git add .")).toEqual(['echo', '.env', '>>', '.gitignore', '&&', 'git', 'add', '.']);
    expect(tokenize('echo "open')).toBeNull();
  });

  it('suggests git when a git subcommand is typed alone', () => {
    const { run } = makeWorld();
    const text = run('status');
    expect(text).toContain('bash: status: command not found');
    expect(text).toContain('`git status`');
  });

  it('cd moves in and out of the clone', () => {
    const { world, run } = makeWorld();
    expect(run('cd bun-cafe')).toContain('No such file or directory');
    run('git clone ' + REPO_URL);
    run('cd bun-cafe');
    expect(world.cwd).toBe('~/bun-cafe');
    run('cd ..');
    expect(world.cwd).toBe('~');
  });

  it('echo writes and appends', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo hello > notes.txt');
    run('echo again >> notes.txt');
    expect(world.local!.work['notes.txt']).toBe('hello\nagain\n');
  });
});

describe('git clone', () => {
  it('clones the team repo with the same history', () => {
    const { world, run } = makeWorld();
    const text = run('git clone ' + REPO_URL);
    expect(text).toContain("Cloning into 'bun-cafe'...");
    expect(world.local!.branches.main).toBe(world.remote.branches.main);
    expect(world.local!.work['README.md']).toContain('أبو فهد');
  });

  it('accepts the URL without .git and with a trailing slash', () => {
    const { world, run } = makeWorld();
    run('git clone https://repo.bun.local/team/bun-cafe/');
    expect(world.local).not.toBeNull();
  });

  it('rejects an unknown repository', () => {
    const { world, run } = makeWorld();
    expect(run('git clone https://repo.bun.local/team/other.git')).toContain('Repository not found');
    expect(world.local).toBeNull();
  });

  it('needs a repository for other commands', () => {
    const { run } = makeWorld();
    expect(run('git status')).toContain('fatal: not a git repository');
  });
});

describe('status, add, commit', () => {
  it('reports a clean tree after cloning', () => {
    const { run } = makeWorld({ cloned: true });
    const text = run('git status');
    expect(text).toContain('On branch main');
    expect(text).toContain("Your branch is up to date with 'origin/main'.");
    expect(text).toContain('nothing to commit, working tree clean');
  });

  it('moves a change from modified to staged to committed', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo "- ريم — متدرب" >> README.md');
    expect(run('git status')).toContain('modified:   README.md');
    run('git add README.md');
    expect(run('git status')).toContain('Changes to be committed:');
    const before = headId(world.local!);
    const text = run('git commit -m "Add Reem to the team list"');
    expect(text).toMatch(/^\[main [0-9a-f]{7}\] Add Reem to the team list/);
    expect(text).toContain('1 file changed, 1 insertion(+)');
    expect(world.local!.commits[headId(world.local!)!]!.parents).toEqual([before]);
    expect(run('git status')).toContain("Your branch is ahead of 'origin/main' by 1 commit.");
  });

  it('refuses to commit with nothing staged and explains why', () => {
    const { out, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    expect(run('git commit -m "Something meaningful here"')).toContain('no changes added to commit');
    run('git status');
    expect(out.tips.length).toBe(0);
  });

  it('coaches on weak commit messages', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    run('git add .');
    const text = run('git commit -m fix');
    expect(text).toContain('--amend');
    run('git commit --amend -m "Add a note to the README"');
    expect(world.local!.commits[headId(world.local!)!]!.message).toBe('Add a note to the README');
  });

  it('commit -a stages tracked files only', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    run('touch new.txt');
    run('git commit -am "Update README with a note"');
    expect(headTree(world.local!)['README.md']).toContain('x');
    expect('new.txt' in headTree(world.local!)).toBe(false);
  });
});

describe('.gitignore', () => {
  it('hides ignored files and refuses to add them explicitly', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo SECRET=1 > .env');
    expect(computeStatus(world.local!).untracked).toEqual(['.env']);
    run('echo .env > .gitignore');
    expect(computeStatus(world.local!).untracked).toEqual(['.gitignore']);
    expect(run('git add .env')).toContain('ignored by one of your .gitignore files');
    run('git add .');
    expect('.env' in world.local!.index).toBe(false);
    expect('.gitignore' in world.local!.index).toBe(true);
  });

  it('supports wildcards', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo "*.env" > .gitignore');
    run('echo a > prod.env');
    expect(computeStatus(world.local!).untracked).toEqual(['.gitignore']);
  });
});

describe('restore and reset', () => {
  it('unstages and discards', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    run('git add README.md');
    run('git restore --staged README.md');
    expect(world.local!.index['README.md']).toBe(world.local!.work['README.md']!.replace('x\n', ''));
    run('git restore README.md');
    expect(world.local!.work['README.md']).toBe(headTree(world.local!)['README.md']);
  });

  it('reset HEAD~1 undoes a commit but keeps the change', () => {
    const { world, run } = makeWorld({ cloned: true });
    const start = headId(world.local!);
    run('echo x >> README.md');
    run('git commit -am "Add a line to the README"');
    expect(run('git reset HEAD~1')).toContain('Unstaged changes after reset:\nM\tREADME.md');
    expect(headId(world.local!)).toBe(start);
    expect(world.local!.work['README.md']).toContain('x');
  });

  it('reset --hard throws the change away', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    run('touch extra.txt');
    run('git add extra.txt');
    expect(run('git reset --hard')).toContain('HEAD is now at');
    expect(world.local!.work['README.md']).toBe(headTree(world.local!)['README.md']);
    expect('extra.txt' in world.local!.work).toBe(false);
  });
});

describe('log, show, diff', () => {
  it('log --oneline decorates the tips', () => {
    const { run } = makeWorld({ cloned: true });
    const first = run('git log --oneline').split('\n')[0]!;
    expect(first).toMatch(/^[0-9a-f]{7} \(HEAD -> main, origin\/main, origin\/HEAD\) Add ريم to the team list$/);
  });

  it('log -- <file> filters by path', () => {
    const { run } = makeWorld({ cloned: true });
    const text = run('git log --oneline -- prices.json');
    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('Raise Saudi coffee price to 15');
    expect(text).toContain('Add prices file for menu items');
  });

  it('log shows authors and Riyadh dates', () => {
    const { run } = makeWorld({ cloned: true });
    const text = run('git log -- prices.json');
    expect(text).toContain('Author: خالد <khalid@bun.team>');
    expect(text).toContain('Date:   Tue Oct 6 14:05:00 2026 +0300');
  });

  it('show prints the diff of a commit', () => {
    const { run } = makeWorld({ cloned: true });
    const text = run('git show HEAD~2');
    expect(text).toContain('-  "saudi_coffee": 12,');
    expect(text).toContain('+  "saudi_coffee": 15,');
  });

  it('show accepts an abbreviated hash and rev:path', () => {
    const { world, run } = makeWorld({ cloned: true });
    const id = world.local!.branches.main!.slice(0, 7);
    expect(run('git show ' + id + ' --stat')).toContain('README.md | 1 +');
    expect(run('git show HEAD~1:README.md')).toBe(README_V2.replace(/\n$/, ''));
  });

  it('diff and diff --staged', () => {
    const { run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    expect(run('git diff')).toContain('+x');
    expect(run('git diff --staged')).toBe('');
    run('git add README.md');
    expect(run('git diff')).toBe('');
    expect(run('git diff --staged')).toContain('+x');
  });

  it('rejects unknown revisions', () => {
    const { run } = makeWorld({ cloned: true });
    expect(run('git show nope')).toContain("fatal: ambiguous argument 'nope'");
  });
});

describe('push, fetch, pull', () => {
  it('pushes new commits to the team', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    run('git commit -am "Add a line to the README"');
    const text = run('git push');
    expect(text).toMatch(/[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/);
    expect(world.remote.branches.main).toBe(world.local!.branches.main);
    expect(run('git push')).toContain('Everything up-to-date');
  });

  it('calls the push hook with the new commits, oldest first', () => {
    const { ctx, run } = makeWorld({ cloned: true });
    const seen: string[] = [];
    ctx.hooks.onPush = (pushed) => seen.push(...pushed.map((c) => c.message));
    run('echo a >> README.md');
    run('git commit -am "First change to the README"');
    run('echo b >> README.md');
    run('git commit -am "Second change to the README"');
    run('git push');
    expect(seen).toEqual(['First change to the README', 'Second change to the README']);
  });

  it('rejects a push when a teammate pushed first, until you pull', () => {
    const { world, run } = makeWorld({ cloned: true });
    // A teammate pushes a commit the player doesn't have.
    const L = world.local!;
    const tip = world.remote.branches.main!;
    const theirs = { ...world.remote.commits[tip]!, id: 'f'.repeat(40), message: 'Teammate change', parents: [tip], tree: { ...world.remote.commits[tip]!.tree, 'menu.html': 'new menu\n' } };
    world.remote.commits[theirs.id] = theirs;
    world.remote.branches.main = theirs.id;

    // Like real git: the remote has a commit we never saw, so even an empty push is rejected.
    expect(run('git push')).toContain('(fetch first)');
    expect(run('git status')).toContain('up to date'); // status doesn't fetch
    run('git fetch');
    expect(run('git status')).toContain("behind 'origin/main' by 1 commit");
    run('git pull');
    expect(L.work['menu.html']).toBe('new menu\n');
    expect(headId(L)).toBe(theirs.id);
  });

  it('says fetch first when the remote moved', () => {
    const { world, run } = makeWorld({ cloned: true });
    const tip = world.remote.branches.main!;
    const theirs = { ...world.remote.commits[tip]!, id: 'e'.repeat(40), parents: [tip] };
    world.remote.commits[theirs.id] = theirs;
    world.remote.branches.main = theirs.id;
    run('echo x >> README.md');
    run('git commit -am "Add a line to the README"');
    expect(run('git push')).toContain('[rejected]        main -> main (fetch first)');
  });

  it('refuses pushes to a protected branch', () => {
    const { world, run } = makeWorld({ cloned: true });
    world.remote.protectedBranches = ['main'];
    run('echo x >> README.md');
    run('git commit -am "Add a line to the README"');
    expect(run('git push')).toContain('(protected branch hook declined)');
  });

  it('respects locks from the game', () => {
    const { ctx, world, run } = makeWorld({ cloned: true });
    ctx.lockedUntil = (f) => (f === 'push --force' || f === 'switch' ? 'Junior' : null);
    run('echo x >> README.md');
    run('git commit -am "Add a line to the README"');
    expect(run('git push --force')).toContain('Junior');
    expect(world.remote.branches.main).not.toBe(world.local!.branches.main);
    expect(run('git switch -c feature')).toContain('ينفتح لك في رتبة Junior');
    expect(run('git checkout feature')).toContain('Junior');
  });

  it('lists branches, and creating one is locked', () => {
    const { ctx, run } = makeWorld({ cloned: true });
    expect(run('git branch')).toBe('* main');
    expect(run('git branch -a')).toContain('remotes/origin/main');
    ctx.lockedUntil = (f) => (f === 'branch create' ? 'Junior' : null);
    expect(run('git branch feature/about')).toContain('Junior');
  });
});
