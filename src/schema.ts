// Light parse of a feature's `## Models` section so the runtime understands the
// entities a feature owns AND the relationships between them. This is what lets a
// feature be more than one flat list: a CHILD entity that references a PARENT
// (e.g. a Comment with a `postId` reference to a Post) yields a parent→child
// SHAPE the server and generator render as cards with nested child lists.
//
// Conventions (deliberately small):
//   - Entity = a `### <Name>` heading under `## Models`. Tag = name lowercased.
//   - Field  = a `- `name` — description` bullet.
//   - A field is a RELATIONSHIP when its description says "reference to <Entity>"
//     / "belongs to <Entity>", or when it is named `<entity>Id` for a known entity.
//   - `id` and `createdAt` are auto-managed (meta) — never rendered as inputs.

export interface Field {
  readonly name: string;
  readonly ref?: string; // entity tag this field points at, when it is a relationship
  readonly meta: boolean; // auto-managed (id / createdAt) — not a user input
}

export interface Entity {
  readonly name: string; // tag: lowercased model name (e.g. "post")
  readonly label: string; // original heading (e.g. "Post")
  readonly fields: readonly Field[];
}

export interface Schema {
  readonly entities: readonly Entity[];
}

export type Shape =
  | { readonly kind: "flat"; readonly entity?: Entity }
  | {
      readonly kind: "parentChild";
      readonly parent: Entity;
      readonly child: Entity;
      readonly refField: string;
    };

const HEADING = /^###\s+(.+?)\s*$/;
const SECTION = /^##\s+(.+?)\s*$/;
const MODELS_SECTION = /^models$/i;
const FIELD = /^\s*[-*]\s+`([^`]+)`\s*(?:[—–-]\s*)?(.*)$/;
const isMeta = (name: string): boolean => /^(id|createdAt)$/.test(name);

// Raw field before relationship resolution (we need every entity name first).
interface RawField {
  readonly name: string;
  readonly description: string;
}

interface RawEntity {
  readonly label: string;
  readonly name: string;
  readonly fields: readonly RawField[];
}

// Pull `### Entity` blocks (and their `- field` bullets) from the Models section.
const parseRawEntities = (markdown: string): readonly RawEntity[] => {
  const lines = markdown.split("\n");
  const entities: RawEntity[] = [];
  let inModels = false;
  let label: string | null = null;
  let fields: RawField[] = [];

  const flush = (): void => {
    if (label !== null) {
      entities.push({ label, name: label.toLowerCase(), fields });
    }
    label = null;
    fields = [];
  };

  for (const line of lines) {
    const section = line.match(SECTION);
    if (section) {
      flush();
      inModels = MODELS_SECTION.test(section[1]?.trim() ?? "");
      continue;
    }
    if (!inModels) continue;

    const heading = line.match(HEADING);
    if (heading) {
      flush();
      label = heading[1]?.trim() ?? "";
      continue;
    }

    const field = line.match(FIELD);
    if (field && label !== null) {
      fields = [
        ...fields,
        { name: field[1]?.trim() ?? "", description: field[2]?.trim() ?? "" },
      ];
    }
  }
  flush();
  return entities;
};

// Decide whether a raw field is a relationship, given all known entity tags.
const resolveRef = (
  field: RawField,
  known: ReadonlySet<string>,
): string | undefined => {
  const phrase = field.description.match(
    /(?:reference to|belongs to)\s+(\w+)/i,
  );
  const byPhrase = phrase?.[1]?.toLowerCase();
  if (byPhrase && known.has(byPhrase)) return byPhrase;

  const suffix = field.name.match(/^(.*)Id$/);
  const byName = suffix?.[1]?.toLowerCase();
  if (byName && known.has(byName)) return byName;

  return undefined;
};

export const parseSchema = (markdown: string): Schema => {
  const raw = parseRawEntities(markdown);
  const known = new Set(raw.map((e) => e.name));
  const entities = raw.map((e) => ({
    name: e.name,
    label: e.label,
    fields: e.fields.map((f) => ({
      name: f.name,
      ref: resolveRef(f, known),
      meta: isMeta(f.name),
    })),
  }));
  return { entities };
};

// The entity's user-editable fields — what the create form renders inputs for.
export const editableFields = (entity: Entity): readonly string[] =>
  entity.fields.filter((f) => !f.meta && !f.ref).map((f) => f.name);

// Derive the page shape: a child entity that references a parent → parent/child,
// otherwise a single flat list (todos-style).
export const featureShape = (schema: Schema): Shape => {
  for (const child of schema.entities) {
    const refField = child.fields.find((f) => f.ref);
    if (!refField?.ref) continue;
    const parent = schema.entities.find((e) => e.name === refField.ref);
    if (parent && parent.name !== child.name) {
      return { kind: "parentChild", parent, child, refField: refField.name };
    }
  }
  return { kind: "flat", entity: schema.entities[0] };
};
