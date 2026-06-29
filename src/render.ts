// Canonical row markup + Turbo Stream helpers. The SAME renderItem produces the
// initial list rows (the generator is told to match it) AND the action fragments.
// Which controls appear is DERIVED FROM THE FEATURE'S STORIES — the framework only
// renders actions the requirements actually declare.

import type { StoredRecord } from "./db";
import { escapeHtml } from "./html";

export const ITEMS_ID = "sj-items";
export const itemId = (id: string): string => `sj-item-${id}`;

export interface FeatureActions {
  readonly create: boolean;
  readonly toggle: boolean;
  readonly delete: boolean;
}

// Heuristic: read the allowed actions from the feature's Markdown (stories).
// The prototype keyword-matches; the explicit `actions` part / the /features
// command will formalize this later.
export const deriveActions = (markdown: string): FeatureActions => {
  const t = markdown.toLowerCase();
  return {
    create: /\b(create|add|new|capture)\b/.test(t),
    toggle: /\b(toggle|complete|mark|check|uncheck|done|finish)\b/.test(t),
    delete: /\b(delete|remove|archive|clear)\b/.test(t),
  };
};

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;

// One list row for a record: [toggle] · text · [delete] — controls gated by actions.
export const renderItem = (
  feature: string,
  record: StoredRecord,
  actions: FeatureActions,
): string => {
  const { id } = record;
  const done = Boolean(record.data.done);
  const text = Object.values(record.data)
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  const action = `/${encodeURIComponent(feature)}/_action`;
  const textStyle = done
    ? ' style="text-decoration:line-through;opacity:.6"'
    : "";

  const toggleForm = actions.toggle
    ? `<form method="post" action="${action}">${hidden("_action", "toggle")}${hidden("_id", id)}${hidden("_field", "done")}<button type="submit" aria-label="toggle">${done ? "✓" : "○"}</button></form>`
    : "";
  const deleteForm = actions.delete
    ? `<form method="post" action="${action}">${hidden("_action", "delete")}${hidden("_id", id)}<button type="submit" aria-label="delete">✕</button></form>`
    : "";

  return `<li id="${itemId(id)}" class="sj-item">${toggleForm}<span class="sj-text"${textStyle}>${escapeHtml(text)}</span>${deleteForm}</li>`;
};

// Wrap markup in a <turbo-stream> so the client applies it to the named target.
export const turboStream = (
  action: "append" | "prepend" | "replace" | "update" | "remove",
  target: string,
  template = "",
): string =>
  action === "remove"
    ? `<turbo-stream action="remove" target="${target}"></turbo-stream>`
    : `<turbo-stream action="${action}" target="${target}"><template>${template}</template></turbo-stream>`;
