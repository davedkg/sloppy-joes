// Canonical row markup + Turbo Stream helpers. The SAME renderItem produces the
// initial list rows (the generator is told to match it) AND the action fragments,
// so an appended/replaced row always looks identical to the rest of the list.

import type { StoredRecord } from "./db";
import { escapeHtml } from "./html";

export const ITEMS_ID = "sj-items";
export const itemId = (id: string): string => `sj-item-${id}`;

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;

// One list row for a record: toggle button · text · delete button.
export const renderItem = (feature: string, record: StoredRecord): string => {
  const { id } = record;
  const done = Boolean(record.data.done);
  const text = Object.values(record.data)
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  const action = `/${encodeURIComponent(feature)}/_action`;
  const textStyle = done
    ? ' style="text-decoration:line-through;opacity:.6"'
    : "";
  return (
    `<li id="${itemId(id)}" class="sj-item">` +
    `<form method="post" action="${action}">${hidden("_action", "toggle")}${hidden("_id", id)}${hidden("_field", "done")}<button type="submit" aria-label="toggle">${done ? "✓" : "○"}</button></form>` +
    `<span class="sj-text"${textStyle}>${escapeHtml(text)}</span>` +
    `<form method="post" action="${action}">${hidden("_action", "delete")}${hidden("_id", id)}<button type="submit" aria-label="delete">✕</button></form>` +
    `</li>`
  );
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
