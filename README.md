# Sloppy Joes

An AI-powered web framework (prototype). You declare **features** as Markdown requirements, and the
framework **generates the web pages at runtime** — per visit — instead of you hand-writing them.

See [`REQUIREMENTS.md`](./REQUIREMENTS.md) for the concept and [`STRUCTURE.md`](./STRUCTURE.md) for
how an app's files are organized.

## Prerequisites

- **Node.js 20+** and npm
- An **Anthropic API key** (the page generator calls Claude)
- macOS/Linux build tools for the native SQLite driver (`better-sqlite3`). On macOS this means the
  **Xcode Command Line Tools** — if `npm install` fails to build it, run `xcode-select --install`
  and reinstall.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key (create a .env file at the repo root — it is gitignored)
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 3. Run the dev server (hot-reloading, no build step)
npm run dev
```

Then open **http://localhost:3000** — you'll see the home page; click **todos** to load the
app. Each visit generates the page from `features/todos.md`.

> The first load of a page takes a few seconds — it's generated live by the model on each visit.

## How it works

- `GET /:feature` reads the app's Markdown (`features/` + `config/`) and asks Claude to generate a
  **structure-only** page; the shell themes it with Pico.css for a consistent look.
- Generated forms POST to `/:feature/_action`; the framework persists the change to **SQLite** and
  uses **Turbo Streams** to update the page in place (no full reload).
- Pages only expose the **actions a feature's stories declare** (e.g. no delete button unless the
  feature says "delete a …").

## Project layout

```
src/                 # the framework (server, generator, db, rendering)
features/            # the app: what it does (Markdown)
config/              # the app: data store + design choices
REQUIREMENTS.md  STRUCTURE.md   # docs
```

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Hot-reloading dev server on :3000 (serves the app at the repo root) |
| `npm run start` | Same, without file watching |
| `npm run typecheck` | `tsc --noEmit` |

## Configuration

- **API key** — `ANTHROPIC_API_KEY` (in `.env` or the environment). Required.
- **Model** — `SLOPPY_MODEL` (default: Claude Haiku 4.5).
- **Data store** — chosen in the app's `config/data.md` (`driver` + `path`); SQLite is the only
  implemented driver. Override the path with `SLOPPY_DB`.
- **Design** — chosen in the app's `config/design.md` (Pico.css for the prototype).

## Run a different app

An "app" is just a directory containing `features/` and `config/`. Point the framework at it:

```bash
SLOPPY_APP_DIR=path/to/your-app npm run start
```

## Share it (optional)

Expose your local server with [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```
