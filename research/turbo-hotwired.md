# Research: Turbo (Hotwire) — can it speed up Sloppy Joes?

> **Date:** 2026-06-27 · **Status:** research notes. **Source:** https://turbo.hotwired.dev/
> (handbook: drive / frames / streams). **Question:** how does Turbo help our latency?

## TL;DR

Turbo sends **HTML over the wire** to get "SPA speed without writing JavaScript." It does **not**
make the LLM faster — it removes the *overhead around* generation: full-page reloads, and
**re-generating the whole page on every action**. Our pages cost ~5s to generate (a Claude call);
today every create/toggle/delete does a 303 → **full regeneration** (~5s each). **Turbo Streams**
would let those actions patch the DOM in place from a tiny server fragment — **no Claude call, no
regeneration → near-instant interactions.** That's the single biggest remaining win.

## What Turbo is (4 parts)

| Part | What it does | Relevance to us |
|------|--------------|-----------------|
| **Turbo Drive** | Intercepts link clicks + form submits, fetches the new page, swaps `<body>` without a full reload; keeps `<head>`/assets; shows a progress bar | Smoother nav between features + after actions; removes white-flash reload overhead. Perceived win, not generation win |
| **Turbo Frames** | `<turbo-frame id>` scopes a region; `src=` + `loading="lazy"` lazy-loads it from a URL; only the matching frame fragment from the response is swapped in | Put the **AI-generated region in a lazy frame** so the shell/chrome paints instantly with a placeholder while the slow generated part loads (and streams) into the frame; lets us refresh just the frame |
| **Turbo Streams** | Server returns `<turbo-stream action=… target=…><template>…</template></turbo-stream>` fragments — `append/prepend/replace/update/remove/before/after/morph` — over a form response (`text/vnd.turbo-stream.html`) or WebSocket/SSE. Surgically updates specific DOM nodes | **The big one.** A create/toggle/delete returns a small fragment that mutates just the affected node — **no full-page regeneration**. Also the path for the v2 live-update vision over SSE/WS |
| **Turbo Native** | Wraps the web app in native iOS/Android shells | Not relevant to the prototype |

## How it attacks our specific bottleneck

Our cost model right now:
- **Cold page load:** one Claude generation (~5s). We already stream it (shell paints in ~3ms).
- **Every action:** 303 redirect → GET `/:feature` → **another full ~5s generation.**

With Turbo:
- **Actions stop regenerating.** `POST /:feature/_action` returns a `turbo-stream` that appends the
  new row / replaces the toggled row / removes the deleted row. DB write + tiny fragment =
  **tens of milliseconds**, no model call. This is the headline improvement.
- **Cold load feels instant.** Wrap the generated content in `<turbo-frame src="/:feature/_frame"
  loading="lazy">`; the shell + nav render immediately, the frame fills in (streamed). Pairs with
  the streaming we already built.
- **Navigation is SPA-smooth.** Turbo Drive removes reload cost and adds a progress indicator.

## What Turbo does NOT fix

- **It does not speed up the model.** The first/cold generation still costs the LLM's time. Turbo
  removes reloads and *re-generations*, not inference. The synergy: **generate once, then mutate via
  Streams** instead of regenerating.

## Cost / tensions to resolve before adopting

1. **Stable DOM targets in AI-generated HTML.** Streams/Frames target known IDs (`target="todos"`,
   item `id="todo_<id>"`). Our HTML is generated, so we'd **extend the generation contract** to
   require stable, contract-defined IDs (we already define an action contract — same idea).
2. **Who renders the action fragment?** Two options:
   - **Templated fragment (server-rendered):** fast + deterministic, but the row's look is no longer
     AI-generated (slight tension with the "AI authors the UI" thesis).
   - **Tiny per-item AI generation:** keep it AI-authored but generate just one small row (cheap,
     sub-second). Or reuse the row markup pattern produced in the last full generation.
3. **Turbo needs JS in the page.** Our generator forbids `<script>`/external resources — correct.
   Turbo would be provided by the **page shell** (`html.ts`), served locally (~one small module),
   not by the generator. Clean separation.
4. **Conflicts with the Renderify plan (M3, pending).** Renderify sandboxes output and **blocks
   `fetch`/scripts**; Turbo depends on both. So **Turbo vs Renderify is a fork** for the
   interactivity layer. Turbo fits the *current* (non-Renderify) prototype now; adopting it may
   compete with the Renderify direction. Decision needed.

## Recommendation (incremental, prototype-friendly)

1. Add Turbo to the page shell + **Turbo Drive** (near-zero effort: include the lib) → smoother nav.
2. Add stable IDs to the generation contract, then make `/:feature/_action` return **Turbo Streams**
   → **actions become instant** (biggest win). Start with server-templated row fragments for speed.
3. Optionally wrap generated content in a **lazy Turbo Frame** for instant cold-paint.
4. Decide Turbo vs Renderify for interactivity before going deep (see tension #4).

## Sources
- https://turbo.hotwired.dev/ · /handbook/drive · /handbook/frames · /handbook/streams
