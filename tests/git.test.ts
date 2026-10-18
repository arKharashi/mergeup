import { describe, expect, it } from 'vitest';
import { computeStatus, headId, headTree, tokenize } from '../src/engine';
import { REPO_URL, README_V2 } from '../src/levels/fixtures';
import { makeGame, makeWorld } from './helpers';

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

  it('runs a pasted clone URL as a path, like bash, and suggests git clone', () => {
    const { world, run } = makeWorld();
    const text = run(REPO_URL + ' && echo after');
    expect(text).toContain('bash: ' + REPO_URL + ': No such file or directory');
    expect(text).toContain('`git clone ' + REPO_URL + '`');
    expect(text).not.toContain('after');
    expect(world.local).toBeNull();
    run('git clone ' + REPO_URL);
    expect(run(REPO_URL)).toContain('`~/bun-cafe`');
  });

  it('suggests git clone for an scp-style URL, which has no slash', () => {
    const { run } = makeWorld();
    const text = run('git@repo.bun.local:bun-cafe.git');
    expect(text).toContain('bash: git@repo.bun.local:bun-cafe.git: command not found');
    expect(text).toContain('`git clone git@repo.bun.local:bun-cafe.git`');
    expect(run('bun-cafe.git')).toContain('`help`');
  });

  it('reports running a folder or a file the way bash 5 does', () => {
    const { run } = makeWorld({ cloned: true });
    expect(run('./README.md')).toBe('bash: ./README.md: Permission denied\n» `README.md` ملف، والملفات ما تنشغّل مثل الأوامر. تشوف محتواه بـ `cat README.md`');
    expect(run('README.md/')).toBe('bash: README.md/: Not a directory');
    expect(run('../bun-cafe')).toBe('bash: ../bun-cafe: Is a directory');
    expect(run('./nope')).toContain('bash: ./nope: No such file or directory');
    run('cd ..');
    expect(run('bun-cafe/')).toBe('bash: bun-cafe/: Is a directory\n» هذا مجلد، والمجلد ما ينشغّل. تدخله بـ `cd ~/bun-cafe`');
    expect(run('~/bun-cafe/.git')).toBe('bash: /home/dev/bun-cafe/.git: Is a directory');
    expect(run('~')).toBe('bash: /home/dev: Is a directory');
    expect(run('bun-cafe/README.md')).toContain('`cd bun-cafe` ثم `cat README.md`');
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

describe('branch, switch, checkout', () => {
  const REF_HINT = 'hint: See `man git check-ref-format`\nhint: Disable this message with "git config set advice.refSyntax false"';

  it('creates a branch without moving HEAD, and lists it', () => {
    const { world, run } = makeWorld({ cloned: true });
    expect(run('git branch feature/about')).toBe('');
    expect(world.local!.branches['feature/about']).toBe(world.local!.branches.main);
    expect(run('git branch')).toBe('  feature/about\n* main');
    expect(run('git branch --show-current')).toBe('main');
  });

  it('refuses a branch that exists and a name git does not allow', () => {
    const { world, run } = makeWorld({ cloned: true });
    expect(run('git branch main')).toBe("fatal: a branch named 'main' already exists");
    expect(run('git switch -c main')).toBe("fatal: a branch named 'main' already exists");
    expect(run('git checkout -b main')).toBe("fatal: a branch named 'main' already exists");
    for (const name of ['bad..name', 'feature/', 'a.lock', 'HEAD', '"feature about"', 'what?']) {
      expect(run('git branch ' + name), name).toBe("fatal: '" + name.replace(/"/g, '') + "' is not a valid branch name\n" + REF_HINT);
    }
    expect(run('git switch -c "a b"')).toBe("fatal: 'a b' is not a valid branch name\n" + REF_HINT);
    expect(Object.keys(world.local!.branches)).toEqual(['main']);
    // Arabic is fine in a branch name.
    expect(run('git branch ميزة/من-نحن')).toBe('');
  });

  it('switch -c makes the branch and moves to it, and the commits go there', () => {
    const { world, run } = makeWorld({ cloned: true });
    const L = world.local!;
    const main = L.branches.main;
    expect(run('git switch -c feature/about')).toBe("Switched to a new branch 'feature/about'");
    expect(run('git status')).toBe('On branch feature/about\nnothing to commit, working tree clean');
    run('echo "<h1>About</h1>" > about.html');
    run('git add about.html');
    expect(run('git commit -m "Add about page"')).toMatch(/^\[feature\/about [0-9a-f]{7}\] Add about page/);
    expect(L.branches.main).toBe(main);
    expect(L.commits[L.branches['feature/about']!]!.parents).toEqual([main]);
    expect(run('git log --oneline -2').split('\n')[1]).toMatch(/^[0-9a-f]{7} \(origin\/main, origin\/HEAD, main\) Add ريم/);
  });

  it('switches between branches, with tracking info for one that has an upstream', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('git switch -c feature/about');
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    expect(run('git switch main')).toBe("Switched to branch 'main'\nYour branch is up to date with 'origin/main'.");
    expect('about.html' in world.local!.work).toBe(false);
    expect(run('git checkout feature/about')).toBe("Switched to branch 'feature/about'");
    expect(world.local!.work['about.html']).toBe('about\n');
    expect(run('git switch -')).toBe("Switched to branch 'main'\nYour branch is up to date with 'origin/main'.");
    expect(run('git checkout -')).toBe("Switched to branch 'feature/about'");
    // Like git's reflog, staying put still counts as a move, so - comes back here.
    expect(run('git switch feature/about')).toBe("Already on 'feature/about'");
    expect(run('git switch -')).toBe("Already on 'feature/about'");
  });

  it('a branch made after a commit on main takes the commit along', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    expect(run('git checkout -b feature/about')).toBe("Switched to a new branch 'feature/about'");
    expect(world.local!.branches['feature/about']).toBe(world.local!.branches.main);
    expect(run('git switch main')).toBe(
      "Switched to branch 'main'\nYour branch is ahead of 'origin/main' by 1 commit.\n  (use \"git push\" to publish your local commits)",
    );
  });

  it('carries uncommitted changes to the other branch and lists them', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('git branch feature/about');
    run('echo x >> README.md');
    run('echo about > about.html');
    run('git add about.html');
    run('touch notes.txt');
    expect(run('git switch feature/about')).toBe("M\tREADME.md\nA\tabout.html\nSwitched to branch 'feature/about'");
    expect(run('git status --short')).toBe(' M README.md\nA  about.html\n?? notes.txt');
    // switch -c without a start point doesn't touch the tree, so git lists nothing.
    expect(run('git switch -c feature/two')).toBe("Switched to a new branch 'feature/two'");
    expect(world.local!.work['README.md']).toContain('x');
  });

  it('refuses to switch when a local change would be overwritten, and changes nothing', () => {
    const { world, run } = makeWorld({ cloned: true });
    const L = world.local!;
    run('git switch -c feature/readme');
    run('echo feature >> README.md');
    run('git commit -am "Add a feature line to the README"');
    run('git switch main');
    run('echo local >> README.md');
    const refusal =
      'error: Your local changes to the following files would be overwritten by checkout:\n\tREADME.md\n' +
      'Please commit your changes or stash them before you switch branches.\nAborting';
    expect(run('git switch feature/readme')).toBe(refusal);
    expect(run('git checkout feature/readme')).toBe(refusal);
    run('git add README.md');
    expect(run('git switch feature/readme')).toBe(refusal);
    expect(L.head).toEqual({ kind: 'branch', name: 'main' });
    expect(L.work['README.md']).toContain('local');
    // Stops a && chain.
    expect(run('git switch feature/readme && echo after')).not.toContain('after');
  });

  it('refuses to overwrite an untracked file, but not an ignored one', () => {
    const { run } = makeWorld({ cloned: true });
    run('git switch -c feature/about');
    run('echo about > about.html');
    run('echo SECRET=1 > .env');
    run('git add about.html .env');
    run('git commit -m "Add about page and env"');
    run('git switch main');
    run('echo mine > about.html');
    expect(run('git switch feature/about')).toBe(
      'error: The following untracked working tree files would be overwritten by checkout:\n\tabout.html\n' +
        'Please move or remove them before you switch branches.\nAborting',
    );
    run('rm about.html');
    run('echo .env > .gitignore');
    run('echo OTHER=2 > .env');
    expect(run('git switch feature/about')).toBe("Switched to branch 'feature/about'");
  });

  it('reports branches and refs that switch cannot go to', () => {
    const { run } = makeWorld({ cloned: true });
    expect(run('git switch nope')).toBe('fatal: invalid reference: nope');
    expect(run('git switch')).toBe('fatal: missing branch or commit argument');
    expect(run('git switch -c')).toBe("error: switch `c' requires a value");
    expect(run('git checkout -b')).toBe("error: switch `b' requires a value");
    expect(run('git switch -c feature about')).toBe('fatal: invalid reference: about');
    expect(run('git checkout -b feature/x nope')).toBe("fatal: 'nope' is not a commit and a branch 'feature/x' cannot be created from it");
    expect(run('git branch feature/x nope')).toBe("fatal: not a valid object name: 'nope'");
    expect(run('git switch -')).toBe('fatal: invalid reference: @{-1}');
    expect(run('git checkout -')).toBe("error: pathspec '-' did not match any file(s) known to git");
    expect(run('git checkout nope')).toBe("error: pathspec 'nope' did not match any file(s) known to git");
    const detach = 'hint: If you want to detach HEAD at the commit, try again with the --detach option.';
    expect(run('git switch origin/main')).toBe("fatal: a branch is expected, got remote branch 'origin/main'\n" + detach);
    expect(run('git switch HEAD~1')).toBe("fatal: a branch is expected, got commit 'HEAD~1'\n" + detach);
  });

  it('checkout <file> restores the file and counts it', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('echo x >> README.md');
    expect(run('git checkout README.md')).toBe('Updated 1 path from the index');
    expect(world.local!.work['README.md']).toBe(headTree(world.local!)['README.md']);
    expect(run('git checkout README.md')).toBe('Updated 0 paths from the index');
    run('echo x >> README.md');
    expect(run('git checkout -- README.md')).toBe('');
    expect(run('git checkout')).toBe("Your branch is up to date with 'origin/main'.");
  });

  it('a remote-tracking start point sets the upstream, and push then wants a matching name', () => {
    const { world, run } = makeWorld({ cloned: true });
    expect(run('git switch -c feature/about origin/main')).toBe(
      "branch 'feature/about' set up to track 'origin/main'.\nSwitched to a new branch 'feature/about'",
    );
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    expect(run('git push')).toContain('fatal: The upstream branch of your current branch does not match\nthe name of your current branch.');
    expect(world.remote.branches['feature/about']).toBeUndefined();
    expect(run('git branch feature/b origin/main')).toBe("branch 'feature/b' set up to track 'origin/main'.");
  });

  it('switching to a branch only the team has makes a local one that tracks it', () => {
    const { world, run } = makeWorld({ cloned: true });
    world.local!.remoteBranches['feature/menu'] = world.local!.branches.main!;
    expect(run('git switch feature/menu')).toBe("branch 'feature/menu' set up to track 'origin/feature/menu'.\nSwitched to a new branch 'feature/menu'");
    expect(world.local!.upstream['feature/menu']).toBe('feature/menu');
  });

  it('renames a branch, keeping HEAD and the upstream on it', () => {
    const { world, run } = makeWorld({ cloned: true });
    run('git switch -c about');
    run('git push -u origin about');
    expect(run('git branch -m feature/about')).toBe('');
    expect(world.local!.head).toEqual({ kind: 'branch', name: 'feature/about' });
    expect(world.local!.upstream['feature/about']).toBe('about');
    expect(run('git branch -m nope feature/x')).toBe("fatal: no branch named 'nope'");
    expect(run('git branch -m main')).toBe("fatal: a branch named 'main' already exists");
    expect(run('git branch -m "a b"')).toBe("fatal: 'a b' is not a valid branch name\n" + REF_HINT);
    expect(run('git branch -m')).toBe('fatal: branch name required');
    expect(run('git branch -m a b c')).toBe('fatal: too many arguments for a rename operation');
  });

  it('deletes merged branches, and keeps unmerged ones without -D', () => {
    const { run } = makeWorld({ cloned: true });
    run('git branch feature/empty');
    expect(run('git branch -d feature/empty')).toMatch(/^Deleted branch feature\/empty \(was [0-9a-f]{7}\)\.$/);
    run('git switch -c feature/about');
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    expect(run('git branch -d feature/about')).toBe(
      "error: cannot delete branch 'feature/about' used by worktree at '/home/dev/bun-cafe'",
    );
    run('git switch main');
    expect(run('git branch -d feature/about')).toBe(
      "error: the branch 'feature/about' is not fully merged\n" +
        "hint: If you are sure you want to delete it, run 'git branch -D feature/about'\n" +
        'hint: Disable this message with "git config set advice.forceDeleteBranch false"',
    );
    expect(run('git branch -d nope')).toBe("error: branch 'nope' not found");
    expect(run('git branch -D feature/about')).toMatch(/^Deleted branch feature\/about \(was [0-9a-f]{7}\)\.$/);
  });

  it('warns when deleting a branch that is pushed but not merged to HEAD', () => {
    const { run } = makeWorld({ cloned: true });
    run('git switch -c feature/about');
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    run('git push -u origin feature/about');
    run('git switch main');
    expect(run('git branch -d feature/about')).toMatch(
      /^warning: deleting branch 'feature\/about' that has been merged to\n {9}'refs\/remotes\/origin\/feature\/about', but not yet merged to HEAD\nDeleted branch feature\/about \(was [0-9a-f]{7}\)\.$/,
    );
  });

  it('branch -vv shows each upstream, and -u sets one', () => {
    const { run } = makeWorld({ cloned: true });
    run('git switch -c feature/about');
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    run('git push origin feature/about');
    expect(run('git branch -vv')).toMatch(/^\* feature\/about [0-9a-f]{7} Add about page\n {2}main {10}[0-9a-f]{7} \[origin\/main\] Add ريم to the team list$/);
    expect(run('git branch -u origin/nope')).toContain("fatal: the requested upstream branch 'origin/nope' does not exist\nhint:");
    expect(run('git branch -u origin/feature/about')).toBe("branch 'feature/about' set up to track 'origin/feature/about'.");
    expect(run('git branch -vv').split('\n')[0]).toMatch(/^\* feature\/about [0-9a-f]{7} \[origin\/feature\/about\] Add about page$/);
  });

  it('decorates log like git: HEAD, remote-tracking refs, then local branches', () => {
    const { run } = makeWorld({ cloned: true });
    run('git switch -c feature/about');
    run('echo about > about.html');
    run('git add about.html');
    run('git commit -m "Add about page"');
    run('git push -u origin feature/about');
    run('git branch feature/copy');
    expect(run('git log --oneline -1')).toMatch(/^[0-9a-f]{7} \(HEAD -> feature\/about, origin\/feature\/about, feature\/copy\) Add about page$/);
  });

  it('completes branch names after git switch', () => {
    const { game } = makeGame();
    game.progress.unlocked = 3;
    game.loadLevel(3);
    const L = game.session!.world.local!;
    L.branches['feature/about'] = L.branches.main!;
    expect(game.completions(['git', 'switch', 'fe'])).toContain('feature/about');
  });
});

describe('push a new branch', () => {
  const branchWithCommit = () => {
    const made = makeWorld({ cloned: true });
    made.world.remote.protectedBranches = ['main'];
    made.run('git switch -c feature/about');
    made.run('echo about > about.html');
    made.run('git add about.html');
    made.run('git commit -m "Add about page"');
    return made;
  };

  it('needs an upstream the first time, even with -u alone', () => {
    const { world, run } = branchWithCommit();
    const fatal =
      'fatal: The current branch feature/about has no upstream branch.\n' +
      'To push the current branch and set the remote as upstream, use\n\n' +
      '    git push --set-upstream origin feature/about\n\n' +
      'To have this happen automatically for branches without a tracking\n' +
      "upstream, see 'push.autoSetupRemote' in 'git help config'.\n";
    expect(run('git push')).toContain(fatal);
    expect(run('git push -u')).toContain(fatal);
    expect(world.remote.branches['feature/about']).toBeUndefined();
  });

  it('push -u origin <branch> sends it and sets the upstream', () => {
    const { world, run } = branchWithCommit();
    const text = run('git push -u origin feature/about');
    expect(text).toContain(" * [new branch]      feature/about -> feature/about\nbranch 'feature/about' set up to track 'origin/feature/about'.");
    expect(world.remote.branches['feature/about']).toBe(world.local!.branches['feature/about']);
    expect(world.local!.upstream['feature/about']).toBe('feature/about');
    expect(run('git status')).toContain("Your branch is up to date with 'origin/feature/about'.");
    expect(run('git push')).toBe('Everything up-to-date');
  });

  it('push without -u sends the branch but leaves no upstream; -u later fixes it', () => {
    const { world, run } = branchWithCommit();
    expect(run('git push origin feature/about')).toContain(' * [new branch]      feature/about -> feature/about');
    expect(world.local!.upstream['feature/about']).toBeUndefined();
    expect(run('git status')).toBe('On branch feature/about\nnothing to commit, working tree clean');
    expect(run('git push -u origin feature/about')).toBe("branch 'feature/about' set up to track 'origin/feature/about'.\nEverything up-to-date");
    expect(world.local!.upstream['feature/about']).toBe('feature/about');
  });

  it('shows HEAD as the source when pushed as HEAD', () => {
    const { run } = branchWithCommit();
    expect(run('git push -u origin HEAD')).toContain(" * [new branch]      HEAD -> feature/about\nbranch 'feature/about' set up to track 'origin/feature/about'.");
  });

  it('tells the game when the team rejects a push to a protected branch', () => {
    const { ctx, run } = branchWithCommit();
    const seen: string[] = [];
    ctx.hooks.onPushRejected = (branch, reason) => seen.push(branch + ' ' + reason);
    run('git switch main');
    run('echo x >> README.md');
    run('git commit -am "Add a line to the README"');
    expect(run('git push')).toContain(' ! [remote rejected] main -> main (protected branch hook declined)');
    expect(run('git push origin feature/about:main')).toContain(' ! [remote rejected] feature/about -> main (protected branch hook declined)');
    expect(seen).toEqual(['main protected', 'main protected']);
  });
});
