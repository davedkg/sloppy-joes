# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sloppy Joes — an AI-powered web framework: a developer declares **features** as Markdown
requirements and the framework **generates the web pages at runtime** (per visit) instead of
hand-writing them. Status: **working prototype** (laptop-only demo). See `REQUIREMENTS.md` for the
spec and `STRUCTURE.md` for the app/file conventions.

Stack: Node + TypeScript (run via `tsx`, no build step) · Hono HTTP server · Anthropic Claude
(Haiku) for generation · SQLite (better-sqlite3) for persistence · Turbo (Streams + Drive) for
instant actions · Pico.css for a consistent theme.

## Repo layout (framework vs. example app)

- `src/` — **the framework**: `server.ts` (routes), `generate.ts` (prompt → streamed page),
  `markdown.ts` (reads an app's `features/` + `config/`), `db.ts` (SQLite, driver/path from
  `config/data.md`), `render.ts` (canonical row markup + Turbo Stream helpers), `html.ts` (shell +
  Pico + Turbo), `log.ts`.
- `example/` — **the example app** (sandboxed): `features/` + `config/` (+ gitignored
  `data/`). The framework loads an app dir via the `SLOPPY_APP_DIR` env var.
- `REQUIREMENTS.md`, `STRUCTURE.md`, `research/` — docs.
- `.env` (gitignored, repo root) — holds `ANTHROPIC_API_KEY`; loaded via `process.loadEnvFile()`.

## Commands

- `npm run dev` — hot-reloading dev server on :3000 (sets `SLOPPY_APP_DIR=example`).
- `npm run start` — same, no watch.
- `npm run typecheck` — `tsc --noEmit`.
- Run a different app: `SLOPPY_APP_DIR=path/to/app npm run start`.
- Requires `ANTHROPIC_API_KEY` (in `.env` or the environment).

## How it works (runtime loop)

`GET /:feature` reads the app's Markdown + that feature's DB records, then **streams** a
structure-only page from Claude (shell paints instantly; Pico themes it). Generated forms POST to
`/:feature/_action`, which persists to SQLite and returns **Turbo Stream** fragments that patch the
DOM in place (append/replace/remove) — no full-page regeneration; a 303 redirect is the non-JS
fallback. The list uses stable `#sj-items` / `#sj-item-<id>` ids so `render.ts` produces matching
markup for both the initial list and the action fragments.

## Claude Config Scope (CRITICAL)

- **All Claude config for this work is scoped to THIS local project**, not global `~/.claude/`.
  Write any rules, preferences, settings, or memory here (this file or project-local `.claude/`),
  never to global `~/.claude/`.

## Interaction Rules (CRITICAL)

- **Ask ONE question at a time.** When clarifying, never batch questions — ask one, wait, then ask
  the next, so the user can steer.
- **Never spawn background workers, workflows, or subagents unless explicitly asked.** This
  overrides any default/ultracode behavior.
