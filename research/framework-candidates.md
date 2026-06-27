# Research: Candidate Frameworks (Generative / Server-Driven UI)

> **Date:** 2026-06-26 · **Status:** shallow scan for review — NOT vetted, NO deep dives yet.
> Purpose: collect frameworks similar to what TanStack does (AI/agent-driven UI rendered in a
> host, with an action round-trip to a backend) so we can pick what to dig into.

## Leading candidate (flagged by user)

### TanStack — possible framework we will use
- `@tanstack/ai-mcp`: host-side MCP client that turns any MCP server's tools/resources/prompts
  into `ServerTool[]` for `chat()` (adapter-agnostic). Pairs with **MCP-UI** for rendering
  generated/served UI widgets. Announced ~June 5, 2026.
- **Why it's a candidate:** TanStack Start/Router/Query/Store give us a real web-app substrate
  (routing, state, data) *plus* the MCP wiring — closest to "render in a webpage with backend,"
  not just in a chat.
- Full detail: see [`tanstack-mcp-generative-ui.md`](./tanstack-mcp-generative-ui.md).

---

## Standards / protocols (the "language" AI uses to describe UI)

- **MCP Apps** — official MCP extension; tools return UI resources rendered (sandboxed iframe)
  in the host. MCP-UI + OpenAI Apps SDK pioneered it. [spec/blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- **MCP-UI** (`@mcp-ui/server`, `@mcp-ui/client`) — SDK implementing MCP Apps; `rawHtml` /
  `externalUrl` / `remoteDom` resource types. [GitHub](https://github.com/MCP-UI-Org/mcp-ui) · [docs](https://mcpui.dev/guide/introduction)
- **AG-UI** (by CopilotKit) — event-based, bidirectional agent↔frontend transport; adopted by
  Google, LangChain, AWS, Microsoft, Mastra, PydanticAI. [comparison](https://www.copilotkit.ai/blog/the-state-of-agentic-ui-comparing-ag-ui-mcp-ui-and-a2ui-protocols)
- **A2UI (Agent-to-UI)** (Google, open project) — declarative JSON UI from a *pre-approved
  component catalog*; renders natively on web/mobile/desktop. [Google blog](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- **OpenUI / OpenUI Lang** (Thesys) — token-efficient format for LLMs to stream full component
  trees at runtime (claims ~3x faster, ~67% fewer tokens than JSON). [overview](https://www.everydev.ai/tools/openui)

## Frameworks / runtimes / SDKs (the "engine")

- **CopilotKit** — agentic app framework + generative-UI runtime (React/Angular/mobile);
  makers of AG-UI. [site](https://www.copilotkit.ai/) · [GitHub](https://github.com/copilotkit/copilotkit)
- **Vercel AI SDK** — Generative UI via streamUI/RSC; pivoting to **json-render**
  (LLM emits schema-validated JSON → mapped to pre-registered components); AI Elements library.
  [AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui) · [GenUI intro](https://vercel.com/blog/ai-sdk-3-generative-ui)
- **Thesys — C1 / Crayon / React SDK** — OpenAI-compatible endpoint that returns *structured
  UI* (tables, charts, forms) instead of text; renders live. [docs](https://docs.thesys.dev/)
- **assistant-ui** — React library for AI chat with generative UI. (per 2026 GenUI guides)
- **Tambo** — generative-UI React components. (per 2026 GenUI guides)
- **Hydra (hydra-ai)** — generative UI. (per 2026 GenUI guides)
- **Renderify** — runtime engine that transpiles + sandboxes + renders LLM-generated JSX/TSX
  (or JSON plans) in the browser, zero build/deploy. [DEV post](https://dev.to/unadlib/renderify-a-runtime-engine-for-rendering-llm-generated-ui-instantly-in-the-browser-1amf)
- **llm-ui** — React library for rendering LLM output. [site](https://llm-ui.com/)

## Host / client implementations (render MCP Apps today)

- **OpenAI Apps SDK** — build interactive ChatGPT apps over MCP; web component in an iframe via
  the MCP Apps UI bridge (JSON-RPC over postMessage). [docs](https://developers.openai.com/apps-sdk/quickstart)
- **Skybridge** — React widgets rendered inside ChatGPT/Claude; `useViewState`/`useToolInfo`
  shared human↔LLM state. [guide](https://betterstack.com/community/guides/ai/skybridge-mcp-apps/)
- **Goose** (Block) — open-source agent; early reference MCP Apps client. [post](https://block.github.io/goose/blog/2025/09/08/turn-any-mcp-server-mcp-ui-compatible/)
- **Claude** — full MCP Apps host support.

## Curated lists / surveys (good review starting points)

- [awesome-generative-ui (narrowin)](https://github.com/narrowin/awesome-generative-ui)
- [The Complete Guide to Generative UI Frameworks in 2026 (Medium)](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc)
- [CopilotKit — Developer's Guide to Generative UI in 2026](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026)
- [CopilotKit — State of Agentic UI: AG-UI vs MCP-UI vs A2UI](https://www.copilotkit.ai/blog/the-state-of-agentic-ui-comparing-ag-ui-mcp-ui-and-a2ui-protocols)

## Quick read (not a recommendation — just orientation)

- Closest to "render in a **webpage** with backend, AI writes the UI": **TanStack + MCP-UI**,
  **CopilotKit (AG-UI)**, **Vercel AI SDK (json-render)**, **Thesys/OpenUI**, **Renderify**.
- Most "chat-host" oriented: **OpenAI Apps SDK**, **Skybridge**, **Goose**.
- Pattern split worth noting: *declarative catalog* (A2UI, json-render, OpenUI) vs *free HTML/JSX*
  (MCP-UI rawHtml, Renderify) — maps onto our undecided §5 "code vs spec" question.
