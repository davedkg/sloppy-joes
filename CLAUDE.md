# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sloppy Joes — an AI-powered web framework that generates web pages at runtime from a set
of user-defined workflows. Status: **requirements-gathering**. No language, stack, or
structure chosen yet; do not assume any. A real architecture/commands section will be
added here once those decisions are made.

## Claude Config Scope (CRITICAL)

- **All Claude config for this work is scoped to THIS local project**, not the global
  `~/.claude/` config. Going forward, write any rules, preferences, settings, or memory
  here (this file or project-local `.claude/`), never to global `~/.claude/`.

## Interaction Rules (CRITICAL)

- **Ask ONE question at a time.** When gathering requirements or clarifying, never batch
  questions — ask one, wait for the answer, then ask the next. This keeps the
  conversation focused and lets the user steer.
