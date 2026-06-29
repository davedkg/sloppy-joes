# Sloppy Joes — App Project Structure

> **Status:** DRAFT. Defines the on-disk structure of an **app built with Sloppy Joes** (the
> equivalent of a `rails new` skeleton) — **not** the framework's own internals. Companion to
> `REQUIREMENTS.md`; FR-* references point there.

## 1. Top-level layout

Two folders:

```
my-app/
├── features/    # CORE APP LOGIC — what the app does
└── config/      # RUNTIME SETUP  — how the app runs
```

`features/` is the only place a developer declares *what the app should do*. Everything in
`config/` is plumbing with batteries-included defaults (FR-A6).

## 2. Core principle — Markdown everything, path is meaning

- **All authoring files are Markdown (`.md`).** The whole app is human-written Markdown that the
  AI reads to generate pages at runtime.
- **No frontmatter, no config-of-config.** The runtime infers **role from the conventional name**
  and **granularity from file-vs-folder**. The path *is* the meaning.
- **Fractal rule — every level is *either a `.md` file or a folder of `.md` files*.** Collapse when
  small, expand as it grows. The same rule applies at every level:

```
App      = features/ + config/
Feature  = todos.md          (file)   OR   todos/            (folder of parts)
Part     = stories.md        (file)   OR   stories/          (folder of items)
Item     = add-a-task.md     (leaf file)
```

## 3. `features/` — the app's logic

### 3.1 A feature

A feature is `features/<name>.md` **or** `features/<name>/`. `<name>` is **plural** (`todos`,
`accounts`). There is no special "feature doc" — a feature is simply a file, or a folder of its
parts.

### 3.2 Feature anatomy

A feature has a small **required core** plus **optional precision layers**. Filling in more
optional parts slides a feature from "loose product requirements" toward "technical spec" (the §4
spectrum in `REQUIREMENTS.md`).

| Part | Conventional name | What it is | Required? | FR |
|------|-------------------|-----------|-----------|----|
| Identity | `identity` | Name + one-line intent | **core** | FR-A1/A2 |
| Stories | `stories` | User stories / requirements the AI generates pages from | **core** | FR-A1, FR-A2 |
| Models | `models` | The entities + relationships this feature owns (1+) | **core** | FR-A4 |
| Actions | `actions` | Named operations for the intent→action channel (else inferred) | optional | FR-D4 |
| Rules | `rules` | Access/permissions, validation, business logic | optional | FR-B1 |
| Presentation | `presentation` | Feature-level UI intent (else global `config/design` + AI) | optional | FR-A3, FR-G5 |

### 3.3 The three granularities

Any part can be inline, its own file, or a folder of items — author's choice, mix freely:

```
# collapsed                # parts as files            # parts as folders
features/todos.md          features/todos/             features/todos/
  (all parts inline)         identity.md                 identity.md
                             stories.md                  stories/
                             models.md                     add-a-task.md
                             ...                           view-my-tasks.md
                                                         models/
                                                           todo.md
                                                         actions/
                                                           create-task.md
                                                         rules.md
                                                         presentation.md
```

### 3.4 Models (data model lives in the feature)

- **Plural — a feature owns one or more entities.** Includes:
  - **Entities** — `Account`, `Todo`, …
  - **Join / link tables** — e.g. `UserAccount` connecting a `User` to many `Account`s.
- A join may reference an entity **owned by another feature or by the auth baseline** (`User`
  comes from `config/auth`). The join table is the canonical **cross-feature reference**.
- **The app's full schema = the union of every feature's `models`.**
- Model files are **singular** (`todo.md`, `user-account.md`).

## 4. `config/` — runtime setup

Markdown like everything else, same file-or-folder rule. Each maps to a runtime decision, with
sensible defaults so most stay near-empty:

| File | Sets up | FR |
|------|---------|----|
| `app` | App identity · feature registry · navigation / home route | FR-A1, FR-B1 |
| `design` | Design system + theme — **Pico.css (classless), structure-only generation** | FR-A3, FR-G5 |
| `data` | Data store **selection** — `driver` + `path` (**SQLite**); **no model** (lives in features) | FR-D1/D2 |
| `ai` | Generation provider/model, Renderify profile, embedded component library | FR-G1, FR-G3/G4 |
| `auth` | Accounts / sessions baseline — **deferred; "a user is anyone" for now** (`REQUIREMENTS.md` §2) | FR-B1 |

## 5. Naming conventions

| Thing | Case | Example |
|-------|------|---------|
| Feature | **plural** | `todos`, `accounts` |
| Conventional part | literal name | `models`, `stories`, `actions` |
| Model / entity | **singular** | `todo`, `user-account` |
| Story / action item | descriptive kebab-case | `add-a-task`, `create-task` |

## 6. Open items

- **Seed / example data** — lives somewhere, **not** in the feature folder; final location TBD
  (`REQUIREMENTS.md` §10 #10).
- **Cross-feature join ownership** — for now, the feature that **declares** the
  relationship owns the join table; references resolve by entity name across the schema union.
- **Item-naming case** for non-model parts (stories/actions) — defaulting to kebab-case.
