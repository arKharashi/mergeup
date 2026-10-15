# Contributing to MergeUp

Thanks for wanting to help. The most useful contribution is a new level: ranks Junior to Team Lead are designed in [docs/design.md](docs/design.md) and waiting to be built.

## Set up

You need Node.js 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # type check and unit tests
npm run e2e      # browser tests (the first time: npx playwright-core install chromium)
```

## Add a level

1. Pick a scenario in [docs/design.md](docs/design.md), and read [CLAUDE.md](CLAUDE.md): it has the project's rules and a checklist for levels.
2. Build the git features the scenario needs in `src/engine` first. Their output must match real git: when unsure, run the same commands in a scratch repo and copy what git prints. Add tests to `tests/git.test.ts`.
3. Write the level as one file in `src/levels/` and add it to `LEVELS`. Every string the player reads is `{ ar, en }`: Saudi Arabic and plain English, each written in its own language.
4. Give it a `solution()` that earns 3 stars (`tests/levels.test.ts` plays it), and add tests for the level's traps.
5. Extend `e2e/course.mjs` to play it, then run `npm run check` and `npm run e2e`.

If you use Claude Code, `/new-level <n>` walks through these steps.

## Pull requests

- One change per commit, with an imperative English subject: "Add the merge conflict level", not "added stuff". This project teaches good commits, so its history should show them.
- `npm run check` must pass; CI runs it on every pull request.
- Check your change at phone width (390px) and on desktop, in both languages.

## Reporting a bug

Open an issue with what you typed, what you expected and what the game printed. If git's output looks wrong, include what real git prints for the same commands.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
