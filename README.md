# MergeUp

**Learn git the way teams use it: by joining one.**
A free browser game, in Arabic and English.

### [▶ Play it in your browser](https://arkharashi.github.io/mergeup/) · [اقرأ بالعربي](README.ar.md)

[![Build and deploy](https://github.com/arKharashi/mergeup/actions/workflows/deploy.yml/badge.svg)](https://github.com/arKharashi/mergeup/actions/workflows/deploy.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-2ea043)](LICENSE)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)

![MergeUp on a desktop: the task and team chat on the left, the terminal in the middle, the project's files on the right](docs/screenshots/desktop-en.png)

You're the new hire on the team that builds the website of Bun, a Saudi specialty coffee shop. Your team lead and teammates are scripted characters: they hand you tasks, quiz you in the team chat and react to what you do. The terminal behaves like real git, and a mistake costs reputation instead of ending the game.

It's made for developers who know `add`, `commit` and `push` but have only ever worked alone.

## Features

- **Real git, in the browser.** `clone`, `status`, `add`, `restore`, `reset`, `rm`, `commit` (with `--amend`), `log`, `show`, `diff`, `fetch`, `pull` and `push` print the same messages as git itself. The shell has `cd`, `ls`, `cat`, `echo` with `>` and `>>`, `&&` chains, quotes, history and Tab completion.
- **A team that reacts.** A vague commit message, a pushed password or two tasks in one commit all have consequences: reputation, stars and a word from the team lead.
- **Teaching, not just checking.** Coaching tips explain each mistake, every level has three tiers of hints, and you can rewind a level at any time.
- **Arabic and English.** Every line of copy exists in both languages, and the layout mirrors between right-to-left and left-to-right.
- **Designed with care.** An Apple-style layout with iMessage-style chat and a macOS Terminal window, in GitHub's colors, in light and dark mode.
- **Any screen.** Three panes on desktop, two on tablets, and one at a time on phones, in portrait and landscape.
- **No account, no server.** It's a static site, and your progress stays in your browser.

Playable now: the Intern rank, 3 levels. The full design, 16 levels over 4 ranks up to Team Lead, is in [docs/design.md](docs/design.md) (in Arabic).

<p align="center">
  <img src="docs/screenshots/phone-ar.png" width="260" alt="On a phone in Arabic: the team lead's questions in the team chat">
  &nbsp;&nbsp;
  <img src="docs/screenshots/phone-en.png" width="260" alt="On a phone in English: one task per commit in the terminal">
</p>

## How it's built

| Part | What it does |
| --- | --- |
| **Engine** · `src/engine` | A git and shell simulator in plain TypeScript, with no DOM and no game rules. Commits form a graph with branches and a remote, a line diff (LCS) produces unified hunks, and a push is rejected when it isn't a fast-forward or targets a protected branch. It's deterministic, so tests can compare its output with real git's. |
| **Game** · `src/game`, `src/levels` | Each level is one TypeScript file: the starting repo, the team's chat script, objectives checked against the repo's state, three tiers of hints, hooks for consequences, and a scripted solution. |
| **UI** · `src/ui` | React 19 and Vite. The `Game` object is the single source of truth, read with `useSyncExternalStore`. The terminal renders a buffer that implements the engine's output interface. |
| **Two languages** | Player-facing text is typed as `{ ar, en }` from the engine to the UI, and CSS logical properties let the English layout mirror the Arabic one. |

## Tests

- **67 unit tests** (Vitest). Git output is checked against what real git prints, every level's scripted solution must earn 3 stars, and everything the player reads must exist in both languages.
- **End-to-end tests** (Playwright) play the whole game like a player: every level and its traps, in both languages, on desktop and phones, in Chromium, WebKit and Firefox, and at 25 screen sizes.
- **CI** type-checks, tests and builds every push, and `main` deploys to GitHub Pages.

## Run it locally

You need Node.js 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # type check and unit tests
npm run e2e      # browser tests (the first time: npx playwright-core install chromium)
npm run build    # the static site, in dist/
```

## Project structure

```
src/engine   git and shell simulator
src/game     game state, level types, ranks and the team
src/levels   one file per level, plus the coffee shop project's history
src/ui       React components
tests/       unit tests
e2e/         end-to-end tests
docs/        game design (Arabic) and screenshots
```

Each level is one file with a scripted solution that the tests play. [CLAUDE.md](CLAUDE.md) has the checklist for writing one.

## License

[MIT](LICENSE) © Abdulrahman Alkharashi
