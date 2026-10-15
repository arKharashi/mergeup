---
description: Build a level of MergeUp from its scenario in docs/design.md
argument-hint: <level number>
---

Build level $ARGUMENTS of MergeUp.

1. Read `CLAUDE.md`, then the scenario for level $ARGUMENTS in `docs/design.md`, and the existing levels in `src/levels/` for style.
2. List what the scenario needs from the engine (commands, flags, NPC actions, UI such as a PR page).
   Check `NOT_YET` in `src/engine/git/index.ts` and `UNLOCKS` in `src/game/ranks.ts`.
   Build missing engine features first. Their output must match real git; add tests to `tests/git.test.ts`.
3. Write `src/levels/lNN-<slug>.ts` following the "Writing a level" checklist in `CLAUDE.md`, and register it in `src/levels/index.ts`.
   Extend the bun-cafe fixtures rather than inventing a new project. Keep every NPC in character.
   Every string the player reads is `{ ar, en }`: Saudi Arabic and plain English, each written in its own language.
4. Give it a `solution()` that earns 3 stars, and add tests in `tests/levels.test.ts` for the level's traps.
5. Run `npm run check` until it passes.
6. Reply with: what the level does, what you added to the engine, and anything you changed from the design and why.
   If you changed the scenario, update `docs/design.md` too.
