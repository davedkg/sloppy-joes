// Sloppy Joes — local dev server.
// GET /:feature generates a structure-only AI page (the shell owns the theme via
// Pico) and returns it in one response. Generated controls + persisted actions are
// limited to what the feature's stories DECLARE (deriveActions). Actions POST to
// /:feature/_action and return Turbo Stream fragments that patch the DOM in place;
// 303 fallback for non-Turbo.

import { readFileSync } from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  createRecord,
  deleteRecord,
  ensureSchema,
  listRecords,
  toggleField,
  updateField,
} from "./db";
import { childrenKey, generatePage } from "./generate";
import { escapeHtml, page } from "./html";
import { addParams } from "./log-context";
import { error, log } from "./log";
import {
  type FeatureSource,
  listFeatures,
  readConfig,
  readFeature,
} from "./markdown";
import { requestLogger } from "./request-logger";
import {
  ITEMS_ID,
  childrenId,
  deriveActions,
  itemId,
  renderItem,
  renderParent,
  turboStream,
} from "./render";
import { editableFields, featureShape, parseSchema } from "./schema";

// Load .env (ANTHROPIC_API_KEY) if present; otherwise rely on the ambient env.
try {
  process.loadEnvFile();
} catch {
  // no .env file — that's fine
}

ensureSchema();

// Front-end assets, read once and served locally (no external CDN).
const asset = (rel: string): string =>
  readFileSync(path.join(process.cwd(), rel), "utf8");
const turboJs = asset("node_modules/@hotwired/turbo/dist/turbo.es2017-umd.js");
const picoCss = asset("node_modules/@picocss/pico/css/pico.min.css");

const app = new Hono();

// Rails-style per-request logging (method/path/params/timings/status).
app.use("*", requestLogger);

const appName = async (): Promise<string> => {
  const config = await readConfig("app");
  const match = config?.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? "Sloppy Joes";
};

const errorPage = (message: string): string =>
  page(
    "Error",
    `<h1>Something went wrong</h1><p class="muted">${escapeHtml(message)}</p><p><a href="/" data-turbo="false">← home</a></p>`,
  );

// Debug view: show the assembled Markdown source instead of generating.
const sourceView = (feature: string, source: FeatureSource): string => {
  const fileList = source.files
    .map((f) => `<li><code>${escapeHtml(f.relPath)}</code></li>`)
    .join("");
  return `<p><a href="/" data-turbo="false">← home</a> · <a href="/${encodeURIComponent(feature)}" data-turbo="false">generated page</a></p>
<h1>${escapeHtml(feature)} <span class="muted">— source</span></h1>
<ul>${fileList}</ul>
<pre>${escapeHtml(source.combined)}</pre>`;
};

// Flatten a stored record into the shape the generator renders: fields + id + createdAt.
const flatten = (r: {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
}) => ({
  ...r.data,
  id: r.id,
  createdAt: r.createdAt,
});

// Build the DATA payload for a parent/child feature: each parent flattened, with
// its children nested under a "<child>s" key (filtered by the relationship field).
const groupParentChild = (
  feature: string,
  parentEntity: string,
  childEntity: string,
  refField: string,
): Record<string, unknown>[] => {
  const parents = listRecords(feature, parentEntity);
  const children = listRecords(feature, childEntity);
  const key = childrenKey(childEntity);
  return parents.map((p) => ({
    ...flatten(p),
    [key]: children.filter((c) => c.data[refField] === p.id).map(flatten),
  }));
};

app.get("/_health", (c) => c.json({ status: "ok" }));

app.get("/_assets/turbo.js", (c) =>
  c.body(turboJs, 200, {
    "Content-Type": "application/javascript; charset=utf-8",
  }),
);
app.get("/_assets/pico.css", (c) =>
  c.body(picoCss, 200, { "Content-Type": "text/css; charset=utf-8" }),
);
app.get("/favicon.ico", (c) => c.body(null, 204));

app.get("/", async (c) => {
  try {
    const [name, features] = await Promise.all([appName(), listFeatures()]);
    const list = features.length
      ? `<ul>${features
          .map(
            (f) =>
              `<li><a href="/${encodeURIComponent(f)}" data-turbo="false">${escapeHtml(f)}</a></li>`,
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
      const body = `<p><a href="/" data-turbo="false">← home</a></p>
<h1>Feature not found</h1>
<p class="muted">No <code>${escapeHtml(feature)}</code> under <code>features/</code>.</p>`;
      return c.html(page("Not found", body), 404);
    }

    if (c.req.query("source") !== undefined) {
      return c.html(page(`${feature} — source`, sourceView(feature, source)));
    }

    const actions = deriveActions(source.combined);
    const shape = featureShape(parseSchema(source.combined));
    const records =
      shape.kind === "parentChild"
        ? groupParentChild(
            feature,
            shape.parent.name,
            shape.child.name,
            shape.refField,
          )
        : listRecords(feature).map(flatten);
    const toolbar = `<p class="muted"><a href="/" data-turbo="false">← home</a> · <a href="/${encodeURIComponent(feature)}?source" data-turbo="false">view source</a> · <a href="/${encodeURIComponent(feature)}" data-turbo="false">↻ regenerate</a></p>`;

    const generated = await generatePage(source, records, actions, shape);
    return c.html(page(feature, `${toolbar}\n${generated}`));
  } catch (err) {
    error(`feature "${feature}" failed: ${(err as Error).message}`);
    return c.html(errorPage((err as Error).message), 500);
  }
});

app.post("/:feature/_action", async (c) => {
  const feature = c.req.param("feature");
  try {
    const source = await readFeature(feature);
    if (!source)
      return c.html(page("Not found", "<h1>Feature not found</h1>"), 404);

    const actions = deriveActions(source.combined);
    const shape = featureShape(parseSchema(source.combined));
    const body = await c.req.parseBody();
    addParams(body);
    const str = (key: string): string => {
      const value = body[key];
      return typeof value === "string" ? value : "";
    };
    const action = str("_action");

    // Only actions the feature's stories DECLARE are allowed.
    const allowed =
      (action === "create" && actions.create) ||
      (action === "toggle" && actions.toggle) ||
      (action === "edit" && actions.edit) ||
      (action === "delete" && actions.delete);
    if (!allowed) {
      return c.html(
        errorPage(`This feature does not declare the "${action}" action`),
        403,
      );
    }

    // Turbo asks for stream responses via the Accept header. If present, patch the
    // DOM in place; otherwise fall back to a redirect (full regeneration).
    const wantsStream = (c.req.header("Accept") ?? "").includes(
      "text/vnd.turbo-stream.html",
    );
    const streamResponse = (html: string) =>
      c.body(html, 200, {
        "Content-Type": "text/vnd.turbo-stream.html; charset=utf-8",
      });

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
      const record = createRecord(feature, entity, data);
      if (wantsStream) {
        // A child record (e.g. a comment) appends into ITS parent's nested list;
        // a parent record appends a card into #sj-items; flat features append a row.
        if (shape.kind === "parentChild" && entity === shape.child.name) {
          const parentId = str(shape.refField);
          const target = parentId ? childrenId(parentId) : ITEMS_ID;
          return streamResponse(
            turboStream("append", target, renderItem(feature, record, actions)),
          );
        }
        if (shape.kind === "parentChild" && entity === shape.parent.name) {
          return streamResponse(
            turboStream(
              "append",
              ITEMS_ID,
              renderParent(
                feature,
                record,
                actions,
                shape.child.name,
                shape.refField,
                editableFields(shape.child),
              ),
            ),
          );
        }
        return streamResponse(
          turboStream("append", ITEMS_ID, renderItem(feature, record, actions)),
        );
      }
    } else if (action === "toggle") {
      const id = str("_id");
      const updated = id ? toggleField(id, str("_field") || "done") : null;
      if (wantsStream && updated) {
        return streamResponse(
          turboStream(
            "replace",
            itemId(id),
            renderItem(feature, updated, actions),
          ),
        );
      }
    } else if (action === "edit") {
      const id = str("_id");
      const field = str("_field");
      const value = str("_value");
      const updated = id && field ? updateField(id, field, value) : null;
      if (wantsStream && updated) {
        return streamResponse(
          turboStream(
            "replace",
            itemId(id),
            renderItem(feature, updated, actions),
          ),
        );
      }
    } else if (action === "delete") {
      const id = str("_id");
      if (id) deleteRecord(id);
      if (wantsStream && id) {
        return streamResponse(turboStream("remove", itemId(id)));
      }
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
