# Research: Renderify (assumed frontend) — Deep Dive

> **Date:** 2026-06-26 · **Status:** research notes. Renderify is the **assumed frontend** for
> Sloppy Joes (working assumption).
> **Repo:** [github.com/webllm/renderify](https://github.com/webllm/renderify) · MIT ·
> **v0.7.0 (May 8, 2026)** · ~99% TypeScript · small/early (23★, 248 commits) · org
> [github.com/webllm](https://github.com/webllm) (maintainer unadlib).

## TL;DR

Renderify is a **runtime-first, bundleless engine that renders LLM-generated UI directly in the
browser** — no build, no backend compile/deploy. It takes either a structured **JSON RuntimePlan**
*or* free-form **TSX/JSX**, normalizes both to one IR (RuntimePlan), runs it through a 7-layer
security gate, resolves npm imports client-side via CDN, and renders with its own DOM
reconciler. **It is a rendering layer only** — no data/persistence/auth/backend, and **no MCP**.

## Two findings that matter most for Sloppy Joes

1. **No MCP, anywhere.** No MCP server, adapter, example, or roadmap item in the repo, the org's
   other repos (`browser-use`, `webblackbox`), or the writeup. If we want MCP (e.g. the MCP-UI
   action model), **we build that bridge ourselves.**
2. **Render-only — no backend/persistence.** Documented limitation: *"No explicit backend data
   wiring — state and data integration rely on manual component logic; no built-in RPC/fetch
   abstraction."* Worse, its security static-analysis **blocks `fetch(`** by default. Since
   Sloppy Joes **mandates persistence + all web-app basics (auth, sessions, etc.)**, Renderify
   covers the *generate-and-render-UI* half and **none of the backend half.** That gap is ours.

## How it works (pipeline)

```
LLM Output → Code Generator → RuntimePlan (IR) → Security Check → Runtime Execution → Interactive UI
```

- **RuntimePlan IR** is the stable contract: `specVersion`, `id`, `version`, `root` (UI tree of
  text/element/component nodes), optional `source` (TSX/JSX code), `imports`, `state`
  (`RuntimeStateModel`), `capabilities` (e.g. `domWrite`), `moduleManifest` (pinned imports).
- **Dual input — directly relevant to our §5 "spec vs code" question. Renderify supports BOTH:**
  - **Path A — JSON RuntimePlan:** schema-constrained, deterministic, audit-friendly (the
    "declarative" approach).
  - **Path B — free-form TSX/JSX:** LLM emits code; extracted into `source` (the "free-form code"
    approach). React code auto-runs on **Preact compat** (~3–4KB).

## Security model (defense-in-depth)

7 layers: static pattern analysis (blocks `eval(`, **`fetch(`**, `document.cookie`, path
traversal) · structural limits (tree depth, node count, source size) · **tag blocklist**
(`script`, `iframe`, `object`, `embed`) · **module allowlist** · manifest integrity (strict mode
needs URL mappings) · execution budgets (wall-clock timeouts) · **sandbox isolation**
(`sandbox-worker` / `sandbox-iframe` / `shadowrealm` / `isolated-vm`, with fallback chains,
fail-closed). Three profiles: **strict / balanced / relaxed.**

## Module resolution (no bundler)

`es-module-lexer` extracts imports → **JSPM CDN** resolution (fallbacks: esm.sh) → recursive
materialize → rewrite imports to blob/data URLs → `dynamic import()`. CSS→`<style>` injection,
JSON→ESM, binaries→proxy modules. `autoPinLatestModuleManifest` pins versions after first run for
determinism. Caveat: limited to packages available on JSPM/esm.sh.

## Interactivity, state, rendering

- Events via `data-renderify-event-*` attributes + `CustomEvent` dispatch; `RuntimeStateModel`
  for state; full React hooks via Preact compat.
- `DefaultUIRenderer`: keyed+positional child reconciliation, differential attribute updates,
  preserves focus/scroll/input values, XSS sanitization on tags/attrs/inline styles.
- **Streaming:** `renderPromptStream` emits `llm-delta` / `preview` / `final` chunks; FNV-1a
  hashing skips re-parse when unchanged.

## Packages & API

Packages: `renderify` (facade), `@renderify/ir`, `@renderify/runtime`, `@renderify/security`,
`@renderify/core`, `@renderify/llm` (OpenAI / Anthropic / Google), `@renderify/cli`
(CLI + browser Playground). Monorepo: pnpm + Turborepo.

Public API:
- `renderPlanInBrowser(plan, { target })` — one-line embed
- `renderPromptStream(prompt)` — streaming progressive render
- `createInteractiveSession(plan, { target })` — event→state→rerender loop
- **LLM is optional** — you can supply a RuntimePlan from any source (your backend, another SDK).

```ts
import { renderPlanInBrowser } from "renderify";
await renderPlanInBrowser(
  { id: "hello", version: 1, root: { type: "text", value: "Loading..." },
    source: { language: "tsx", code: `export default () => <section>Hi</section>;` } },
  { target: "#mount" },
);
```

- **Plugin system:** 10 hook points (before/after LLM, codegen, policy check, runtime, render) —
  this is likely **where we'd inject persistence/data-fetch and any MCP bridge.**

## Related docs / examples

- `docs/` in repo: architecture, RuntimePlan IR, runtime execution, browser integration,
  security, plugin system, troubleshooting, cookbook, performance tuning.
- `examples/`: `browser-runtime-example.html`, `browser-tsx-jspm-example.html`,
  `recharts-dashboard-plan.json`.
- Writeup: [DEV — Renderify](https://dev.to/unadlib/renderify-a-runtime-engine-for-rendering-llm-generated-ui-instantly-in-the-browser-1amf).

## Other documented limitations

Streaming covers codegen only (not state/data) · TSX supported but no real type-checking ·
module availability gated by JSPM/esm.sh · execution budgets don't stop sync CPU blocking ·
blob/module memory needs cleanup · ShadowRealm/Worker support varies by browser.

## Implications for Sloppy Joes (for discussion — not decided)

- **Renderify = the "AI generates UI, render it safely per visit" engine.** It fits our
  fresh-per-visit + no-build vision well, and it natively supports *both* spec and code paths.
- **We own everything behind the UI:** persistence, auth/sessions, actions, and the data the
  generated UI reads/writes. Renderify's `fetch(`-block + plugin hooks mean we'd route data
  through a controlled channel (host-provided actions/capabilities), not ad-hoc `fetch` in
  generated code. This is essentially the MCP-UI `intent → tool call` pattern — which we'd
  implement ourselves since Renderify has no MCP.
- **Maturity risk:** v0.7.0, tiny community — expect to read/patch source.

## Sources
- [github.com/webllm/renderify](https://github.com/webllm/renderify)
- [github.com/webllm (org)](https://github.com/webllm)
- [DEV — Renderify writeup](https://dev.to/unadlib/renderify-a-runtime-engine-for-rendering-llm-generated-ui-instantly-in-the-browser-1amf)
