// Canonical row markup + Turbo Stream helpers. The SAME render functions produce
// the initial list markup (the generator is told to match them) AND the action
// fragments that patch the DOM. Which controls appear is DERIVED FROM THE FEATURE'S
// STORIES — the framework only renders actions the requirements actually declare.
//
// Two shapes:
//   - LEAF rows (`renderItem`) — a todo or a comment: text + optional toggle/delete.
//   - PARENT cards (`renderParent`) — a post: header + body + a nested child list
//     (`sj-children-<id>`) + a child-create form, so a new post is immediately
//     commentable.

import type { StoredRecord } from "./db";
import { escapeHtml } from "./html";

export const ITEMS_ID = "sj-items";
export const itemId = (id: string): string => `sj-item-${id}`;
export const childrenId = (parentId: string): string =>
  `sj-children-${parentId}`;

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
    create: /\b(create|add|new|capture|comment)\b/.test(t),
    toggle: /\b(toggle|complete|mark|check|uncheck|done|finish)\b/.test(t),
    delete: /\b(delete|remove|archive|clear)\b/.test(t),
  };
};

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;

const actionPath = (feature: string): string =>
  `/${encodeURIComponent(feature)}/_action`;

// Meta keys never shown as body text (rendered via controls or hidden refs).
const META_KEYS = new Set(["id", "createdAt", "done"]);
const isRefKey = (key: string): boolean => /Id$/.test(key);

// String fields of a record that should be shown as text, in a stable order
// (an `author` field, when present, reads first).
const textFields = (
  data: Readonly<Record<string, unknown>>,
): readonly [string, string][] =>
  Object.entries(data)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" &&
        !entry[0].startsWith("_") &&
        !META_KEYS.has(entry[0]) &&
        !isRefKey(entry[0]),
    )
    .sort(([a], [b]) => Number(b === "author") - Number(a === "author"));

// Delete is destructive: data-turbo-confirm makes Turbo prompt before submitting
// (the shell's Turbo JS handles it; non-JS submits still fall through to the 303).
const deleteForm = (feature: string, id: string, noun: string): string =>
  `<form method="post" action="${actionPath(feature)}" data-turbo-confirm="Delete this ${escapeHtml(noun)}?">${hidden("_action", "delete")}${hidden("_id", id)}<button type="submit" aria-label="delete">✕</button></form>`;

// One leaf row: [toggle] · text · [delete] — controls gated by actions.
export const renderItem = (
  feature: string,
  record: StoredRecord,
  actions: FeatureActions,
): string => {
  const { id } = record;
  const done = Boolean(record.data.done);
  const fields = textFields(record.data);
  const author = fields.find(([key]) => key === "author")?.[1];
  const rest = fields
    .filter(([key]) => key !== "author")
    .map(([, value]) => escapeHtml(value))
    .join(" ");
  const text = author
    ? `<strong>${escapeHtml(author)}</strong> ${rest}`.trim()
    : rest;

  const textStyle = done
    ? ' style="text-decoration:line-through;opacity:.6"'
    : "";
  const toggleForm = actions.toggle
    ? `<form method="post" action="${actionPath(feature)}">${hidden("_action", "toggle")}${hidden("_id", id)}${hidden("_field", "done")}<button type="submit" aria-label="toggle">${done ? "✓" : "○"}</button></form>`
    : "";
  const remove = actions.delete ? deleteForm(feature, id, record.entity) : "";

  return `<li id="${itemId(id)}" class="sj-item">${toggleForm}<span class="sj-text"${textStyle}>${text}</span>${remove}</li>`;
};

// The create form for a child entity, scoped to one parent (carries the parent's
// id in the relationship field so the comment attaches to the right post).
export const childForm = (
  feature: string,
  childEntity: string,
  refField: string,
  parentId: string,
  fields: readonly string[],
): string => {
  const inputs = fields
    .map(
      (name) =>
        `<input type="text" name="${escapeHtml(name)}" placeholder="${escapeHtml(name)}" required>`,
    )
    .join("");
  return `<form method="post" action="${actionPath(feature)}">${hidden("_action", "create")}${hidden("_entity", childEntity)}${hidden(refField, parentId)}${inputs}<button type="submit">Add ${escapeHtml(childEntity)}</button></form>`;
};

// One parent card: header + body + nested (initially empty) child list + child form.
export const renderParent = (
  feature: string,
  record: StoredRecord,
  actions: FeatureActions,
  childEntity: string,
  refField: string,
  childFields: readonly string[],
): string => {
  const { id, data } = record;
  const title =
    typeof data.title === "string"
      ? data.title
      : (textFields(data)[0]?.[1] ?? "");
  const author = typeof data.author === "string" ? data.author : "";
  const body = typeof data.body === "string" ? data.body : "";

  const byline = author ? ` <small>by ${escapeHtml(author)}</small>` : "";
  const bodyHtml = body ? `<p>${escapeHtml(body)}</p>` : "";
  const remove = actions.delete ? deleteForm(feature, id, record.entity) : "";
  const form = actions.create
    ? childForm(feature, childEntity, refField, id, childFields)
    : "";

  return `<li id="${itemId(id)}" class="sj-item"><article><header><strong>${escapeHtml(title)}</strong>${byline}</header>${bodyHtml}<ul id="${childrenId(id)}"></ul>${form}${remove}</article></li>`;
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
