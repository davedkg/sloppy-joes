# Research: TanStack + MCP — Generative UI Widgets

> **Date:** 2026-06-26 · **Status:** research notes only (NOT committed requirements).
> **Trigger:** @tan_stack tweet (paywalled, HTTP 402 — could not read directly) about using
> MCP to generate UI widgets inside a chat. **Goal:** understand the pattern so Sloppy Joes
> can do the same thing, but rendered **inside a full webpage with backend functionality**
> instead of inside a chat.

## TL;DR

The "AI generates UI widgets inside a chat" pattern is **MCP-UI** (an emerging "MCP Apps"
standard). An MCP server returns a **UI resource** alongside a tool result; the chat host
renders it (usually in a sandboxed iframe), and user interactions are emitted back as
**structured action events** that the agent turns into further tool calls / backend
operations. TanStack's June 2026 release (`@tanstack/ai-mcp`) is the **host-side plumbing**
that wires any MCP server's tools/resources into its `chat()`. Skybridge is an alternative
framework for the same "interactive widget inside ChatGPT/Claude" idea.

For Sloppy Joes the interesting bit is the **rendering substrate + action round-trip**, which
generalizes from "chat host" to "web page host."

## 1. What TanStack announced (`@tanstack/ai-mcp`)

- Host-side **Model Context Protocol client** for TanStack AI, announced ~**June 5, 2026**.
- Turns any MCP-compliant server's **tools, resources, and prompts** into ordinary
  `ServerTool[]` you spread into `chat()`. Adapter-agnostic (OpenAI / Anthropic / Gemini /
  Ollama), works with any agent loop.
- Connect one server or a pool; managed or manual lifecycle; tunable type-safety (zero-config
  discovery → fully generated end-to-end types).
- **Note:** this package itself is about exposing MCP *tools* to a chat — the *UI widget*
  rendering is the separate **MCP-UI** layer below.

## 2. The actual mechanism: MCP-UI ("MCP Apps")

An MCP server returns a **`UIResource`** as (part of) a tool result:
- `uri`: unique id, `ui://` scheme
- `mimeType`: `text/html;profile=mcp-app` (the MCP Apps standard)
- content: inline `text` (HTML) or Base64 `blob` for larger payloads

**Server SDK** `@mcp-ui/server` → `createUIResource(...)` validates URI scheme / MIME type /
encoding. Three resource types (tradeoffs):

| Type | How it renders | Best for |
|------|----------------|----------|
| `rawHtml` | self-contained HTML in a **sandboxed iframe** (`srcDoc`) | simple cards/status; strong isolation, limited dynamic behavior |
| `externalUrl` | existing web app loaded via iframe `src` | embedding full dashboards/tools |
| `remoteDom` | **Shopify Remote DOM** — JS runs sandboxed but renders through the **host's own component library/design system** | matching host look-and-feel; no iframe overhead; ties to React/Web Components |

**Client SDK** `@mcp-ui/client` → `<UIResourceRenderer>` / `<AppRenderer>` auto-detects the
resource type and applies sandboxing by MIME type. Example:

```jsx
<UIResourceRenderer
  resource={mcpResource.resource}
  onUIAction={(action) => handleAgentAction(action)}
  autoResizeIframe={{ height: true, width: false }}
/>
```

**Action / round-trip model (the important part for backend functionality):**
Components do **not** mutate host state directly. They emit structured events over
`postMessage` (origin-checked); the host invokes a tool call directly **or** hands the intent
to the agent. Four primary event types:
- `tool` → `{ toolName, params }`
- `intent` → `{ intent, params }`
- `prompt` → `{ prompt }`
- `notify` → `{ message }`

e.g. a product card emits an `addToCart` **intent** rather than executing it; the agent
validates against business logic (inventory, pricing) and then calls the real tool. This
mediation layer is how UI interactions become real backend operations.

## 3. Alternative: Skybridge

- TypeScript/React framework for **interactive React widgets rendered (in an iframe) inside
  AI chatbots** (ChatGPT, Claude), replacing static text with live UIs.
- Shared state between human and LLM via hooks: `useViewState` (read/update widget state),
  `useToolInfo` (tool metadata). The LLM can read and programmatically update widget state in
  real time.
- Handles protocol bridging, real-time state sync, security policies, and dev tunneling.

## 4. Relevance to Sloppy Joes

- **Same idea, different host.** TanStack/MCP-UI render generated UI inside a *chat*; Sloppy
  Joes wants to render inside a *full web page with backend*. Conceptually the "host" just
  changes from a chat surface to the Sloppy Joes page renderer.
- **`remoteDom` is the closest fit** to our current working assumption (a frontend framework
  with predefined components embedded; AI generates HTML composing them). Remote DOM maps
  generated UI onto the host's own component library/design system — exactly that shape.
- **The action model answers an open question.** MCP-UI's `tool`/`intent` events →
  agent-mediated tool calls is a ready-made pattern for our §6 ("how do generated pages
  perform actions / persist data") — though we have explicitly *not* decided that yet.
- **Key difference / the gap Sloppy Joes fills.** In MCP-UI the widget HTML is typically
  authored by the MCP server/tool (per-tool, hand-built). Sloppy Joes wants the **UI itself
  AI-generated at runtime from product requirements/user stories**. So Sloppy Joes ≈
  *MCP-UI-style rendering substrate + action round-trip* **+** *an AI that authors the
  page/UIResource on the fly from requirements*.

## Open questions this raises (for later)

- Do we adopt MCP/MCP-UI as the transport, or just borrow the architecture?
- iframe (`rawHtml`/`externalUrl`) vs Remote DOM for our "embedded components" assumption?
- Is the AI generating per-visit HTML, or generating/altering a `UIResource` the renderer consumes?
- How do generated-page actions bind to backend (the intent→tool mediation) — ties to §6.

## Sources

- [TanStack AI — MCP Server Tools docs](https://tanstack.com/ai/latest/docs/tools/mcp) (403 on fetch)
- [TanStack Blog — "Your MCP, your way"](https://tanstack.com/blog/your-mcp-your-way) (403 on fetch)
- [MCP-UI — Introduction](https://mcpui.dev/guide/introduction)
- [MCP-UI — UIResourceRenderer](https://mcpui.dev/guide/client/resource-renderer)
- [GitHub — MCP-UI-Org/mcp-ui](https://github.com/MCP-UI-Org/mcp-ui)
- [WorkOS — MCP-UI technical deep dive](https://workos.com/blog/mcp-ui-a-technical-deep-dive-into-interactive-agent-interfaces)
- [Better Stack — Skybridge: MCP apps inside AI chatbots](https://betterstack.com/community/guides/ai/skybridge-mcp-apps/)
- [GitHub — jherr/mcp-ui-on-tanstack](https://github.com/jherr/mcp-ui-on-tanstack)
- [DEV — MCP-UI + TanStack](https://dev.to/shiva_shanker_k/mcp-ui-tanstack-the-react-stack-thats-changing-everything-8ah)
