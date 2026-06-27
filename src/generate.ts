// Turn a feature's Markdown + its real DB records into a working page, STREAMED.
// Uses Haiku for low latency; the host page provides base styles so output stays
// small. The caller streams chunks straight to the browser as they arrive.

import Anthropic from "@anthropic-ai/sdk";
import type { FeatureSource } from "./markdown";

// Haiku 4.5 — much lower latency than Sonnet for HTML generation.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const systemPrompt = (
  feature: string,
): string => `You are the page generator for "Sloppy Joes",
a framework that turns a feature's Markdown requirements into a working web page at runtime.

Output the HTML for a single page implementing the feature's user stories. Rules:
- Output ONLY the HTML that goes inside <body> — no <!doctype>, <html>, <head>, or <body> tags,
  and no Markdown code fences.
- The host page already provides clean base styles (typography, links, inputs, buttons). Do NOT
  restyle those. Add at most a SMALL <style> block for feature-specific layout. Keep output compact.
- Use semantic HTML. No <script> and no external resources (images, fonts, CDNs).
- Render EXACTLY the records in the DATA section. NEVER invent or add rows. If empty, show a short
  empty state.
- Wire interactions with plain HTML <form> posts (no JavaScript) to "/${feature}/_action", each
  with a hidden input "_action":
    • Create: _action=create, hidden _entity=<entity, e.g. todo>, a text input per editable field
      (name=field, e.g. title), and a submit button.
    • Toggle: _action=toggle, hidden _id=<record id>, hidden _field=<boolean field, e.g. done>,
      and a submit button.
    • Delete: _action=delete, hidden _id=<record id>, and a submit button.
  The server persists the change and reloads this page after each action.`;

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
