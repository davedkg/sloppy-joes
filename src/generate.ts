// Turn a feature's Markdown + its real DB records into a working page.
// Generation is STRUCTURE-ONLY (the shell owns the theme) and reflects ONLY the
// actions the feature's stories declare. Returns the full page body at once
// (no streaming). The list uses stable ids so actions patch rows via Turbo Streams.

import Anthropic from "@anthropic-ai/sdk";
import { time } from "./log-context";
import type { FeatureSource } from "./markdown";
import type { FeatureActions } from "./render";

// Haiku 4.5 — much lower latency than Sonnet for HTML generation.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const systemPrompt = (feature: string, actions: FeatureActions): string => {
  const allowed =
    [
      actions.create && "create",
      actions.toggle && "toggle",
      actions.delete && "delete",
    ]
      .filter(Boolean)
      .join(", ") || "(none)";

  const toggleForm = actions.toggle
    ? `<form method="post" action="/${feature}/_action"><input type="hidden" name="_action" value="toggle"><input type="hidden" name="_id" value="ID"><input type="hidden" name="_field" value="done"><button type="submit" aria-label="toggle">MARK</button></form>`
    : "";
  const deleteForm = actions.delete
    ? `<form method="post" action="/${feature}/_action"><input type="hidden" name="_action" value="delete"><input type="hidden" name="_id" value="ID"><button type="submit" aria-label="delete">✕</button></form>`
    : "";
  const rowTemplate = `<li id="sj-item-ID" class="sj-item">${toggleForm}<span class="sj-text"STYLE>TEXT</span>${deleteForm}</li>`;

  const createSection = actions.create
    ? `3) A create form (entity is the model name, e.g. todo; one text input per editable field):
   <form method="post" action="/${feature}/_action"><input type="hidden" name="_action" value="create"><input type="hidden" name="_entity" value="ENTITY"><input type="text" name="title" placeholder="..." required><button type="submit">Add</button></form>`
    : `3) Do NOT render a create form — this feature does not declare a "create" action.`;

  const markExplain = actions.toggle
    ? `MARK is ✓ when the record's done is true else ○; STYLE is ' style="text-decoration:line-through;opacity:.6"' when done is true else empty; `
    : "";

  return `You are the page generator for "Sloppy Joes", a framework that turns a feature's Markdown
requirements into a working web page at runtime.

Output the HTML that goes inside <main> for a page implementing the feature's user stories.

ALLOWED ACTIONS for this feature: ${allowed}. Render ONLY these. Do NOT add any control, button,
link, or form for an action NOT in this list (for example, no delete button unless 'delete' is
allowed). The page must reflect the requirements EXACTLY — nothing more, nothing less.

STYLING — IMPORTANT: the host page already provides a COMPLETE design system (Pico.css, classless).
Your job is STRUCTURE + CONTENT only:
- Do NOT output any <style> block, inline style for theming, color, font, or class names for styling.
- Just write clean SEMANTIC HTML; the theme styles it.
- No <script> and no external resources. No Markdown code fences.
- Render EXACTLY the records in the DATA section. NEVER invent rows.

You MUST use these exact structures (these specific ids/classes are required):

1) The list container — always include it (empty if there are no records):
   <ul id="sj-items"> ...one row per record... </ul>

2) Each record row MUST be EXACTLY (use the record's real "id" value from DATA; ${markExplain}TEXT is
   the record's text field(s)):
   ${rowTemplate}

${createSection}

Add a heading and a short intro line. Return raw HTML only.`;
};

const userContent = (
  feature: FeatureSource,
  records: readonly Record<string, unknown>[],
): string => `Feature: ${feature.name}

REQUIREMENTS (Markdown):
${feature.combined}

DATA — render these exactly; do not invent more (JSON):
${JSON.stringify(records, null, 2)}`;

const stripFences = (text: string): string =>
  text
    .replace(/^\s*```(?:html)?[ \t]*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();

// Generate the full page body (no streaming) and return it as one string.
export const generatePage = async (
  feature: FeatureSource,
  records: readonly Record<string, unknown>[],
  actions: FeatureActions,
): Promise<string> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set (add it to .env or the environment)",
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.SLOPPY_MODEL ?? DEFAULT_MODEL;

  const message = await time(
    "AI",
    `generate (${model})`,
    () =>
      client.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        system: systemPrompt(feature.name, actions),
        messages: [{ role: "user", content: userContent(feature, records) }],
      }),
    (m) => {
      const out = m.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
      return `${kb}KB, ${m.usage.input_tokens}→${m.usage.output_tokens} tok`;
    },
  );

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return stripFences(text);
};
