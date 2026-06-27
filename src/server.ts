// Sloppy Joes — local dev server (M4).
// On each visit the server reads the feature's Markdown + its real DB records
// and asks Claude to generate the page. Generated forms POST to /:feature/_action,
// which persists to SQLite and reloads the page. M3 (Renderify) is still pending.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  createRecord,
  deleteRecord,
  ensureSchema,
  listRecords,
  toggleField,
} from "./db";
import { generatePage } from "./generate";
import { escapeHtml, page } from "./html";
import { error, log } from "./log";
import {
  type FeatureSource,
  listFeatures,
  readConfig,
  readFeature,
} from "./markdown";

// Load .env (ANTHROPIC_API_KEY) if present; otherwise rely on the ambient env.
try {
  process.loadEnvFile();
} catch {
  // no .env file — that's fine
}

ensureSchema();

const app = new Hono();

const appName = async (): Promise<string> => {
  const config = await readConfig("app");
  const match = config?.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? "Sloppy Joes";
};

const errorPage = (message: string): string =>
  page(
    "Error",
    `<h1>Something went wrong</h1><p class="muted">${escapeHtml(message)}</p><p><a href="/">← home</a></p>`,
  );

// Debug view: show the assembled Markdown source instead of generating.
const sourceView = (feature: string, source: FeatureSource): string => {
  const fileList = source.files
    .map((f) => `<li><code>${escapeHtml(f.relPath)}</code></li>`)
    .join("");
  return `<p><a href="/">← home</a> · <a href="/${encodeURIComponent(feature)}">generated page</a></p>
<h1>${escapeHtml(feature)} <span class="muted">— source</span></h1>
<ul>${fileList}</ul>
<pre>${escapeHtml(source.combined)}</pre>`;
};

// Flatten a stored record into the shape the generator renders: id + fields + createdAt.
const flatten = (r: {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
}) => ({
  ...r.data,
  id: r.id,
  createdAt: r.createdAt,
});

app.get("/_health", (c) => c.json({ status: "ok" }));

app.get("/", async (c) => {
  try {
    const [name, features] = await Promise.all([appName(), listFeatures()]);
    const list = features.length
      ? `<ul>${features
          .map(
            (f) =>
              `<li><a href="/${encodeURIComponent(f)}">${escapeHtml(f)}</a></li>`,
          )
          .join("")}</ul>`
      : `<p class="muted">No features yet. Add one under <code>features/</code>.</p>`;
    const body = `<h1>${escapeHtml(name)}</h1>
<p class="muted">Pages are generated at runtime from the Markdown in <code>features/</code>.</p>
<h2>Features</h2>
${list}`;
    return c.html(page(name, body));
  } catch (err) {
    error(`home failed: ${(err as Error).message}`);
    return c.html(errorPage((err as Error).message), 500);
  }
});

app.get("/:feature", async (c) => {
  const feature = c.req.param("feature");
  try {
    const source = await readFeature(feature);
    if (!source) {
      const body = `<p><a href="/">← home</a></p>
<h1>Feature not found</h1>
<p class="muted">No <code>${escapeHtml(feature)}</code> under <code>features/</code>.</p>`;
      return c.html(page("Not found", body), 404);
    }

    if (c.req.query("source") !== undefined) {
      return c.html(page(`${feature} — source`, sourceView(feature, source)));
    }

    const records = listRecords(feature).map(flatten);
    const generated = await generatePage(source, records);
    const toolbar = `<p class="muted"><a href="/">← home</a> · <a href="/${encodeURIComponent(feature)}?source">view source</a> · <a href="/${encodeURIComponent(feature)}">↻ regenerate</a></p>`;
    return c.html(page(feature, `${toolbar}\n${generated}`));
  } catch (err) {
    error(`feature "${feature}" failed: ${(err as Error).message}`);
    return c.html(errorPage((err as Error).message), 500);
  }
});

const ACTIONS = new Set(["create", "toggle", "delete"]);

app.post("/:feature/_action", async (c) => {
  const feature = c.req.param("feature");
  try {
    const source = await readFeature(feature);
    if (!source)
      return c.html(page("Not found", "<h1>Feature not found</h1>"), 404);

    const body = await c.req.parseBody();
    const str = (key: string): string => {
      const value = body[key];
      return typeof value === "string" ? value : "";
    };
    const action = str("_action");
    if (!ACTIONS.has(action)) {
      return c.html(errorPage(`Unknown action: ${action}`), 400);
    }

    if (action === "create") {
      const entity = str("_entity") || "item";
      const data = Object.fromEntries(
        Object.entries(body)
          .filter(([key]) => !key.startsWith("_"))
          .map(([key, value]) => [
            key,
            typeof value === "string" ? value : String(value),
          ]),
      );
      createRecord(feature, entity, data);
    } else if (action === "toggle") {
      const id = str("_id");
      if (id) toggleField(id, str("_field") || "done");
    } else if (action === "delete") {
      const id = str("_id");
      if (id) deleteRecord(id);
    }

    return c.redirect(`/${encodeURIComponent(feature)}`, 303);
  } catch (err) {
    error(`action on "${feature}" failed: ${(err as Error).message}`);
    return c.html(errorPage((err as Error).message), 500);
  }
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  log(`Sloppy Joes dev server on http://localhost:${info.port}`);
});
