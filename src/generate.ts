// Turn a feature's Markdown + its real DB records into a working page, STREAMED.
// Uses Haiku for low latency; the host page provides base styles + Turbo so output
// stays small. The list uses stable ids so actions can patch rows via Turbo Streams
// without regenerating the page.

import Anthropic from "@anthropic-ai/sdk";
import type { FeatureSource } from "./markdown";

// Haiku 4.5 — much lower latency than Sonnet for HTML generation.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const systemPrompt = (
  feature: string,
): string => `You are the page generator for "Sloppy Joes",
a framework that turns a feature's Markdown requirements into a working web page at runtime.

Output the HTML that goes inside <body> for a page implementing the feature's user stories.
Rules:
- Output ONLY body HTML — no <!doctype>, <html>, <head>, <body> tags, and no Markdown fences.
- The host page already provides base styles (typography, links, inputs, buttons) AND the Turbo
  library. Add at most a SMALL <style> block for layout. Keep output compact. No <script> and no
  external resources (images, fonts, CDNs).
- Render EXACTLY the records in the DATA section. NEVER invent rows.

You MUST use these exact structures so the framework can update the list live:

1) The list container — always include it (empty if there are no records):
   <ul id="sj-items"> ...one row per record... </ul>

2) Each record row MUST be EXACTLY (substitute the record's real id and text; use the record's
   own "id" value from DATA):
   <li id="sj-item-ID" class="sj-item"><form method="post" action="/${feature}/_action"><input type="hidden" name="_action" value="toggle"><input type="hidden" name="_id" value="ID"><input type="hidden" name="_field" value="done"><button type="submit" aria-label="toggle">MARK</button></form><span class="sj-text"STYLE>TEXT</span><form method="post" action="/${feature}/_action"><input type="hidden" name="_action" value="delete"><input type="hidden" name="_id" value="ID"><button type="submit" aria-label="delete">✕</button></form></li>
   where: MARK is ✓ when the record's done is true else ○; STYLE is
   ' style="text-decoration:line-through;opacity:.6"' when done is true else empty; TEXT is the
   record's text field(s) (e.g. its title).

3) A create form (entity is the model name, e.g. todo; one text input per editable field):
   <form method="post" action="/${feature}/_action"><input type="hidden" name="_action" value="create"><input type="hidden" name="_entity" value="ENTITY"><input type="text" name="title" placeholder="..." required><button type="submit">Add</button></form>

You may add page chrome (a heading, short intro, layout) around these. Return raw HTML only.`;

const userContent = (
  feature: FeatureSource,
  records: readonly Record<string, unknown>[],
): string => `Feature: ${feature.name}

REQUIREMENTS (Markdown):
${feature.combined}

DATA — render these exactly; do not invent more (JSON):
${JSON.stringify(records, null, 2)}`;

const stripLeadingFence = (text: string): string =>
  text.replace(/^\s*```(?:html)?[ \t]*\n?/i, "");

// Stream the generated page body to `onText`, dropping a leading code fence if any.
export const generatePageStream = async (
  feature: FeatureSource,
  records: readonly Record<string, unknown>[],
  onText: (chunk: string) => void | Promise<void>,
): Promise<void> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set (add it to .env or the environment)",
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.SLOPPY_MODEL ?? DEFAULT_MODEL;

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt(feature.name),
    messages: [{ role: "user", content: userContent(feature, records) }],
  });

  let started = false;
  let head = "";
  for await (const event of stream) {
    if (
      event.type !== "content_block_delta" ||
      event.delta.type !== "text_delta"
    )
      continue;
    const text = event.delta.text;
    if (started) {
      await onText(text);
      continue;
    }
    // Buffer the very start just long enough to drop a leading ```html fence.
    head += text;
    if (head.length < 8 && !head.includes("\n")) continue;
    started = true;
    await onText(stripLeadingFence(head));
  }
  if (!started && head) await onText(stripLeadingFence(head));
};
