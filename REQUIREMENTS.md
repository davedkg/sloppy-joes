# Sloppy Joes — Requirements

> **Status:** DRAFT (prototype). Built collaboratively. Decided items are stated as
> requirements; leanings and open items are marked _(leaning)_ / _(TBD)_ and consolidated in
> §10. Research backing the architecture assumptions lives in `research/`.

## 1. Overview

Sloppy Joes is an **AI-powered web framework for developers** — in the same category as Ruby on
Rails or Django (opinionated, convention over configuration, batteries-included). The
difference: the developer **does not hand-author pages**. They declare a set of **modules**
(product requirements / user stories), and at **runtime the AI generates the actual pages** that
move the end user through those modules.

Think of it as: *vibe-code the requirements, and the running app becomes them* — with no
write-code → compile → deploy cycle. "No-code" applies to the **page authoring** (you don't
write the UI), not to the audience (the audience is developers).

## 2. Scope & Status

- **This is a PROTOTYPE.** The goal is to prove the concept and functional behavior.
- **Out of scope for now:** non-functional requirements — performance, latency, cost, scale,
  production hardening.
- Language, stack, and deployment are **undecided**.
- **Users, sessions & authentication are deferred.** Until told otherwise, **a user is anyone** —
  treat the app as a single anonymous / shared user: no accounts, no login, no per-user ownership.
  Something to come back to (see §10).

## 3. Personas

- **Developer / author (primary):** a software developer who builds an app by declaring modules
  (requirements/user stories) + design guidance, instead of hand-coding pages.
- **End user:** uses the generated app; sees a freshly generated page on each visit.

## 4. Core Concepts

- **App** — a set of modules.
- **Module** — a distinct thing the app can do, declared by the developer; the unit the AI
  generates pages against. (Renamed from "workflow" because an app does more than one thing.)
- **Module artifact** — what the developer writes to declare a module. Sits on a **spectrum
  between production requirements (loose, outcome-focused) and technical specifications**
  (precise). Exact form _(TBD)_.
- **Page** — a runtime, AI-generated UI rendered to the end user for a module. Regenerated on
  every visit.

## 5. How It Works (the runtime loop)

1. End user visits the app.
2. The framework feeds the relevant module's requirements (+ design guidance + data model) to an
   AI, which **generates the page** for that visit.
3. The generated UI is **rendered in the browser** (via Renderify — see §8), reading from and
   writing to persisted data.
4. The page is **freshly generated on every visit** — not cached, not guaranteed identical across
   visits or users.

## 6. Functional Requirements

### 6.1 Authoring
- **FR-A1** — A developer builds an app by declaring a set of **modules**.
- **FR-A2** — Modules are authored as an artifact between **production requirements and technical
  specifications** (user stories / requirements). _Form & structure: TBD._
- **FR-A3** — The developer supplies **design guidance** (a UI/styling system, e.g.
  Bootstrap/Tailwind/ShadCN) that the generated UI follows. _Supported systems: TBD._
- **FR-A4** — The developer **defines a data model** somewhere. _Location/format: TBD._
- **FR-A5** — Authoring is **single-level** (no separate app-config vs per-module tiers) for now.
- **FR-A6** — **Convention over configuration:** sensible batteries-included defaults; the
  developer declares modules and rarely overrides.

### 6.2 Runtime Generation & Rendering
- **FR-G1** — On each end-user visit, the framework uses **AI to generate the page at runtime**
  from the module's requirements.
- **FR-G2** — Pages are **generated fresh on every visit** (no caching/pinning); not guaranteed
  stable across visits or users.
- **FR-G3** — Generated UI is **rendered in the browser via Renderify**, with **no
  build/compile/deploy** step.
- **FR-G4** — The AI generates UI by composing **pre-defined components embedded in the frontend**
  (working assumption). Output may be **code (TSX/JSX)** or a **spec (RuntimePlan JSON)** —
  Renderify supports both; choice _(TBD)_.
- **FR-G5** — Generated pages follow the developer's **design guidance** (FR-A3).

### 6.3 Data, Persistence & Actions
- **FR-D1** — Application data **must be persisted**.
- **FR-D2** — Data store **_(leaning)_:** a hosted, schemaless-ish DB such as **Supabase**.
- **FR-D3** — Generated pages can **read** persisted data to render content.
- **FR-D4** — Generated pages can **perform actions** that create/update/delete persisted data.
  _Mechanism TBD_ — likely an intent→action channel (generated UI emits intents; the host
  executes the real data operation), since Renderify deliberately has no backend and blocks
  direct `fetch()`.

### 6.4 Baseline Capabilities (batteries-included)
- **FR-B1** — The framework must provide, **by convention**, the baseline capabilities common to
  typical web apps — e.g. data/persistence (CRUD), accounts/auth & sessions, forms & validation,
  navigation/routing, lists/search, file handling, notifications, and security basics. _Exact
  enumeration and the prototype subset: TBD._ **Accounts/auth & sessions are deferred (§2) and not
  in the current prototype subset.**

### 6.5 Live Upgrades (future — v2/v3)
- **FR-L1** — A developer can change app functionality on a **live, deployed** app by editing the
  requirements/user stories; the **next page rendered reflects the change** ("real-time upgrades").

### 6.6 Authoring Commands
The framework ships interactive commands for authoring; `/features` is the first.

- **FR-C1** — A **`/features` command** creates or modifies features in `features/` from a
  natural-language description (the developer's stories). It is the primary way the `features/`
  folder is edited.
- **FR-C2** — `/features` **parses** the description into the feature anatomy — `identity`,
  `stories`, `models` — and **infers** the rest: a candidate model from the stories, with
  `actions` left inferred per convention (not written unless opted in).
- **FR-C3** — `/features` is **interactive**: before writing, it asks clarifying questions **only
  where it cannot infer and the answer changes the output.** Minimum question set, each with a
  sensible default: (a) **ownership/auth** — per-user vs shared _(deferred while auth is off (§2):
  defaults to shared/anonymous and is not asked)_; (b) **model shape** — confirm or extend fields;
  (c) **on-disk layout** — single collapsed file vs expanded folder.
- **FR-C4** — `/features` is **additive / non-destructive**: re-running on an existing feature
  **merges** (adds missing stories/fields) and confirms changes rather than overwriting.
- **FR-C5** — `/features` writes **Markdown following `STRUCTURE.md` conventions** — plural feature
  name, singular model files, the file-or-folder fractal, and the conventional part names.
- **FR-C6** — **Model inference rules:** a 1:many relationship (e.g. per-user ownership) produces
  a **foreign key** (`userId → User`); a many-to-many produces a **join table**; enabling
  ownership adds the owner reference **and** a `rules` part. _While auth is deferred (§2), per-user
  ownership is inactive — no `userId → User` refs or auth `rules` are generated; the
  many-to-many → join-table rule still applies to non-user entities._

## 7. Example App (running reference)

A **todo list** is the canonical example: things it can do include _add a task_, _view tasks_,
_mark complete_, _delete a task_. How these map onto modules, and the detailed workflows, are
deferred until we deep-dive the example.

## 8. Architecture Assumptions (working — see `research/`)

- **Frontend: Renderify** — a runtime-first, bundleless engine that renders LLM-generated UI
  (JSON `RuntimePlan` **or** free-form TSX/JSX) in the browser, no build step. **Render-only:**
  no backend/persistence/auth and **no MCP** — that layer is ours to build. (`research/renderify-deep-dive.md`)
- **Pattern reference: MCP-UI / TanStack** — the "AI generates interactive UI + actions route to a
  backend" pattern; Sloppy Joes adapts it from a chat host to a full web page.
  (`research/tanstack-mcp-generative-ui.md`, `research/framework-candidates.md`)
- **Data: Supabase** _(leaning)_.

## 9. Non-Goals (prototype)

- Performance, cost, latency, scale, and production hardening (see §2).
- A non-technical / pure no-code audience (Sloppy Joes targets developers).
- Caching or guaranteeing identical pages across visits (fresh-per-visit is intentional).

## 10. Open Decisions (consolidated)

1. **Module artifact** — exact form/structure and where it sits on the requirements↔spec spectrum.
2. **AI output** — code (TSX/JSX) vs spec (RuntimePlan JSON).
3. **Design systems** — which UI/styling systems are supported.
4. **Data** — confirm store (Supabase?), reconcile "schemaless" vs Postgres, and **where/how the
   model is defined**.
5. **Actions/backend** — how generated pages bind to backend operations (the intent→action
   channel / MCP-style bridge we'd build, since Renderify lacks one).
6. **Baseline scope** — which of the batteries-included capabilities the prototype must include.
7. **Stack** — language, runtime, deployment.
8. **Prototype success criteria** — the concrete demo that proves the concept.
9. **Example app** — detailed todo-list modules/workflows.
10. **Seed / example data** — where it lives. Decided: **not** inside the feature folder;
    final location TBD.
11. **Authoring commands beyond `/features`** — e.g. commands for `config`, models, or
    app scaffolding. TBD.
12. **Users, sessions & authentication** — deferred (§2); "a user is anyone" for now. Revisit
    per-user ownership, the `/features` ownership question, the auth `rules`, and `config/auth`.
13. **Action naming & versioning** — action names must be **clear and decisive**. Changing what an
    action *does* must not break references still using the old name (e.g. renaming/repurposing
    `DO_Stuff`). Likely need **runtime action versioning** so old and new stay in sync — especially
    once live upgrades (§6.5) let a deployed app's actions change underneath existing pages. Ties to
    FR-D4 and FR-C6.
14. **E2E tests against features** — the framework should be able to drive a generated app in a
    real browser (Playwright) and assert each feature's **stories** hold (e.g. *create a todo →
    it appears in the list*). A feature's stories double as its test spec. This is also the
    primary tool for investigating runtime/behavioral issues — without it, debugging relies on
    reading static output. (Open: deterministic generation / a pin-and-replay mode, since
    fresh-per-visit (FR-G2) makes runs non-reproducible.)

## 11. Future TODOs

Enhancements to build later — distinct from the open *decisions* in §10.

1. **Configure the webpage generator** — make the runtime page generator configurable instead of
   hardcoded (it currently lives in `src/generate.ts` with a fixed model, system prompt, and
   "static HTML, no JS" constraints). Should be driven by `config/ai` (FR-G1/G4): model, system
   prompt / generation instructions, output format (HTML vs RuntimePlan vs TSX), token/length
   limits, and design system — with possible per-feature overrides via the `presentation` part.
2. **Caching of generated pages** — cache generated output (e.g. keyed on a hash of the feature
   Markdown + record data) so unchanged state serves instantly, regenerating only when the source
   or data changes. Bends the fresh-per-visit rule (FR-G2); revisit deliberately later.
