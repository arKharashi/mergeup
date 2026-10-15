# Zumala Git (زملاء Git)

A free browser game that teaches git and teamwork to developers who have only worked alone.
The player is a new hire on the team behind "بُن", a Saudi specialty coffee shop website.
A manager and teammates are computer-controlled characters (NPCs) driven by scripts. There is no AI and no server.
16 levels over 4 ranks: Intern → Junior → Senior → Team Lead.

- **Design spec (the source of truth for levels):** `docs/design.md` (Arabic). Read the level's scenario before building it.
- **Audience:** Arabic-speaking developers. UI copy is Saudi Arabic. git output stays in English, like real git.
- **Constraints:** free to run, static site (GitHub Pages), everything in the browser, progress in `localStorage`.

## Commands

```bash
npm install          # keep package-lock.json committed (see Gotchas)
npm run dev          # http://localhost:5173
npm test             # vitest, once
npm run test:watch
npm run typecheck
npm run check        # typecheck + tests. Run before every commit.
npm run build        # -> dist/
```

In dev, the console exposes the game: `__game.loadLevel(3)`, `__game.run('git log --oneline')`,
`__game.progress.unlocked = 16` (open every built level), `__game.session.world` (inspect repos).

## Architecture

```
src/
  engine/    Pure git + shell simulator. No DOM, no game rules. Deterministic and unit-tested.
    git/     One file per command group: sync (clone/fetch/pull/push/remote), stage (add/restore/rm/reset),
             commit, history (log/show/diff), status, refs (rev parsing, decorations), format (dates, diffs, stats).
    shell.ts Tokenizer (quotes, &&, ;, >, >>) and shell builtins (ls, cd, cat, echo, touch, rm, help...).
  game/      Game class (sessions, objectives, reputation, stars, chat, files), Level types, ranks, NPC team, progress.
  levels/    One file per level, plus fixtures.ts: the bun-cafe project and its scripted history.
  ui/        DOM views only (terminal, chat, task card, files, header, overlays, panes). No game logic.
tests/       Engine behaviour vs real git, and every level's scripted solution must earn 3 stars.
docs/        design.md
```

Flow of one command: `TerminalView` → `game.run(line)` → `runLine(ctx)` mutates the `World` and prints to `Out`
→ engine hooks (`onCommit`, `onPush`) → the level reacts through `LevelApi` (`say`, `tip`, `rep`, `fail`)
→ the game checks objectives → events (`change`, `chat`, `rep`, `complete`, `fail`) → views re-render.

Key types:
- `World` (`src/engine/types.ts`): `remote` (the team's repo), `local` (the player's clone or null), `cwd`, `me`.
- `Tree` is a flat `path → content` map (no folders yet). `Commit.parents` is an array, so merges fit the model.
- `LocalRepo.head` is `{kind:'branch', name}` or detached; `branches`, `remoteBranches` (origin/*), `upstream`.
- `Level` (`src/game/level.ts`): `setup`, `intro`, `objectives`, `hints` (3 tiers), `help`, hooks, `solution`.

## Engine rules

- **Match real git.** Messages, spacing, hints and exit behaviour must match git 2.4x for the same situation.
  When unsure, reproduce it with real git in a scratch repo and copy the output. Tests assert exact strings.
- git output is English. Arabic appears only in `out.tip(...)` coaching lines (rendered RTL in the terminal).
- No level-specific logic in the engine. Levels react through hooks; the engine only reports what happened.
- Commands not simulated yet are listed in `NOT_YET` (`src/engine/git/index.ts`).
  Rank gates live in `UNLOCKS` (`src/game/ranks.ts`); the engine asks `ctx.lockedUntil(feature)`.
  Pseudo-features exist for parts of a command: `'branch create'`, `'push --force'`.
- A command returns `false` on failure, which stops an `&&` chain. Record nothing in `ctx.ran` on failure.
- Every new command or flag gets tests in `tests/git.test.ts`.

## Writing a level

Use `/new-level <n>` (see `.claude/commands/new-level.md`) or follow this checklist:

1. Read the scenario in `docs/design.md`. List the engine features it needs and build those first, with tests.
2. Create `src/levels/lNN-<slug>.ts` exporting a `Level`, and add it to `LEVELS` in `src/levels/index.ts` (index = id − 1).
3. `setup(player)`: return the starting world from fixtures (`bunCafeHistory`, `cloneRepo`), plus any `data`.
   Extend the bun-cafe project; don't invent a new one. New files and NPC commits go in `fixtures.ts`.
4. `intro(api)`: NPC chat via `api.say(who, text, opts)`. Questions use `opts.question` (see level 2).
5. `objectives`: 3–5 checks on world state (the remote, the clone, files). Use `api.ran` only for read-only
   commands such as `log`. Objectives are re-checked after every command and every saved file.
6. `hints`: tier 1 a nudge, tier 2 the commands, tier 3 the full solution (opening it costs the third star).
7. `help`: the `help` cheat sheet, `[command, Arabic description]`.
8. Hooks for consequences: `onCommit`, `onPush` (return `'handled'` to skip the default commit-message check),
   `api.rep(delta, reason)`, `api.fail(reason)`. Mistakes should cost reputation and teach, not dead-end.
9. `solution(player)`: a script that beats the level. `tests/levels.test.ts` plays it and requires 3 stars.
10. Add tests for the level's traps (what happens when the player does the wrong thing).
11. `npm run check`, then play it in the browser at desktop and phone width.

## Copy and characters

- Player-facing text is Saudi Arabic dialect: short, friendly, concrete. "حياك في الفريق"، "وش تغيّر"، "ارفعه للفريق".
- Wrap commands, file names and paths in backticks; `md()` turns them into `<code>`, which is isolated LTR.
- Keep each NPC in character (`src/game/team.ts`): أبو فهد calm and explains why; خالد strict and terse;
  سارة fast and merges without asking; نورة helpful; ريان eager and careless; سلمان unsure.
- Commit messages, file names and code inside the bun-cafe project are English.
- No emoji in the UI.

## UI

- Colours are tokens in `src/styles.css`: light on `:root`, dark under `prefers-color-scheme` and `[data-theme="dark"]`.
  Never hard-code a colour in a component.
- Fonts: Reem Kufi (display), IBM Plex Sans Arabic (body), IBM Plex Mono (terminal and code).
- Layout: desktop three columns (task + chat, terminal, files); tablet two with tabs; phone one pane with tabs.
  Check 390px wide: no horizontal page scroll.
- The chat paces NPC messages ("typing…"); overlays wait for the chat to finish (`chat.whenIdle()`).
- Respect `prefers-reduced-motion`.

## Storage

`localStorage` key `zumala-git:progress:v1`, shape `Progress` in `src/game/progress.ts`. Reading and writing
must never throw (private windows). If the shape changes, bump the key version and migrate.
The in-level repo is not saved: reloading the page restarts the current level.

## Roadmap

- [x] Intern: levels 1–3
- [ ] Junior: levels 4–6. Engine first: `git branch <name>`, `switch` (`-c`), `checkout <branch>`, `merge`
      with conflict markers written to the working tree, `merge --abort`, protected `main` (already in `push`),
      a PR model (branch → main, review comments, approve, CI status) and a PR page in the UI.
- [ ] Senior: levels 7–11. `stash`, `revert`, `cherry-pick`, `rebase` (plain and interactive), `push --force-with-lease`
      (already in `push`), time-based NPC triggers (Abu Fahd interrupts mid-task).
- [ ] Team Lead: levels 12–16. Reviewing NPC PRs, review tone choices, merge ordering, `reflog`, branch protection
      settings, `CODEOWNERS`, `tag`.
- [ ] Export/import progress as a JSON file.
- [ ] Save the in-level state so a reload doesn't restart the level.
- [ ] CONTRIBUTING.md for community levels, and a license (MIT suggested).

## Gotchas

- npm 10 crashes with "Cannot read properties of null (reading 'edgesOut')" when it resolves vitest's peer
  dependencies without a lockfile. Keep `package-lock.json` committed and use `npm ci` in CI.
- `vite.config.ts` uses `base: './'` so the build works under `https://<user>.github.io/<repo>/`.
- Dates in git output use Riyadh time (+0300), the team's timezone (`gitDate` in `format.ts`).
- Player names can match an NPC's name ("خالد"); level checks must not confuse them (see `hasPlayerLine`).
- This project teaches good commits, so its own history should have them: one change per commit, imperative English subject.
