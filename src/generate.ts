// M4: turn a feature's Markdown + its real DB records into a working page.
// Claude renders the actual data (no invented seeds) and wires interactions
// through plain HTML <form> posts to the action endpoint.

import Anthropic from "@anthropic-ai/sdk";
import type { FeatureSource } from "./markdown";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const systemPrompt = (
  feature: string,
): string => `You are the page generator for "Sloppy Joes",
a framework that turns a feature's Markdown requirements into a working web page at runtime.

Output the HTML for a single page that implements the feature's user stories. Rules:
- Output ONLY the HTML that goes inside <body> — no <!doctype>, <html>, <head>, or <body> tags.
- Use clean, semantic HTML and ONE <style> block. Do NOT use <script> or load external resources.
- Render EXACTLY the records given in the DATA section. NEVER invent, add, or hallucinate rows.
  If the data array is empty, show a friendly empty state.
- Wire interactions with plain HTML <form> elements (no JavaScript). The backend contract is a
  POST to "/${feature}/_action" with a hidden input named "_action":
    • Create:  _action=create, hidden _entity=<entity name, e.g. todo>, plus a text input per
               editable field (use the field name, e.g. name="title"). Include a submit button.
    • Toggle:  _action=toggle, hidden _id=<record id>, hidden _field=<boolean field, e.g. done>,
               and a submit <button> (do NOT use an auto-submitting checkbox — keep it JS-free).
    • Delete:  _action=delete, hidden _id=<record id>, and a submit <button>.
  After any action the server persists it and reloads this page, so no JavaScript is needed.
- Return raw HTML only — no Markdown code fences, no commentary.`;

const stripFences = (text: string): string =>
  text
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

export const generatePage = async (
  feature: FeatureSource,
  records: readonly Record<string, unknown>[],
): Promise<string> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set (add it to .env or the environment)",
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.SLOPPY_MODEL ?? DEFAULT_MODEL;

  const userContent = `Feature: ${feature.name}

REQUIREMENTS (Markdown):
${feature.combined}

DATA — the records to render, as JSON (render these exactly; do not invent more):
${JSON.stringify(records, null, 2)}`;

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    system: systemPrompt(feature.name),
    messages: [{ role: "user", content: userContent }],
  });

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  return stripFences(text);
};
