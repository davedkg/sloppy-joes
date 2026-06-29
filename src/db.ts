// Lightweight local persistence. The DB is PICKED in config/data.md (driver +
// path); SQLite (better-sqlite3) is the implemented driver.
// Schemaless-ish: every entity is a JSON `data` blob in one `records` table,
// tagged by feature + entity — works for any feature without per-model DDL.

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { log } from "./log";
import { timeSync } from "./log-context";

const appDir = (): string => process.env.SLOPPY_APP_DIR ?? process.cwd();

interface DataConfig {
  readonly driver: string;
  readonly path: string;
}

// Read config/data.md for the DB choice. Falls back to a local SQLite file.
const readDataConfig = (): DataConfig => {
  const fallback: DataConfig = { driver: "sqlite", path: "data/sloppy.db" };
  try {
    const text = readFileSync(path.join(appDir(), "config", "data.md"), "utf8");
    const driver =
      text.match(/driver:\s*(\S+)/i)?.[1]?.toLowerCase() ?? fallback.driver;
    const dbPath = text.match(/path:\s*(\S+)/i)?.[1] ?? fallback.path;
    return { driver, path: dbPath };
  } catch {
    return fallback;
  }
};

const config = readDataConfig();
if (config.driver !== "sqlite") {
  throw new Error(
    `config/data.md selects driver "${config.driver}", but only "sqlite" is implemented`,
  );
}

const dbPath = process.env.SLOPPY_DB ?? path.resolve(appDir(), config.path);
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export interface StoredRecord {
  readonly id: string;
  readonly feature: string;
  readonly entity: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

interface Row {
  readonly id: string;
  readonly feature: string;
  readonly entity: string;
  readonly data: string;
  readonly created_at: string;
}

const toRecord = (row: Row): StoredRecord => ({
  id: row.id,
  feature: row.feature,
  entity: row.entity,
  data: JSON.parse(row.data) as Record<string, unknown>,
  createdAt: row.created_at,
});

const getRow = (id: string): Row | undefined =>
  db.prepare("select * from records where id = ?").get(id) as Row | undefined;

export const ensureSchema = (): void => {
  db.exec(`
    create table if not exists records (
      id text primary key,
      feature text not null,
      entity text not null,
      data text not null default '{}',
      created_at text not null default (datetime('now'))
    );
    create index if not exists records_feature_idx on records (feature, entity);
  `);
  log(`database ready (${config.driver}) at ${dbPath}`);
};

export const listRecords = (feature: string, entity?: string): StoredRecord[] =>
  timeSync(
    "DB",
    `listRecords(${feature}${entity ? `, ${entity}` : ""})`,
    () => {
      const rows = (
        entity
          ? db
              .prepare(
                "select * from records where feature = ? and entity = ? order by created_at asc",
              )
              .all(feature, entity)
          : db
              .prepare(
                "select * from records where feature = ? order by created_at asc",
              )
              .all(feature)
      ) as Row[];
      return rows.map(toRecord);
    },
    (records) => `${records.length} rows`,
  );

export const createRecord = (
  feature: string,
  entity: string,
  data: Record<string, unknown>,
): StoredRecord =>
  timeSync("DB", `createRecord(${feature}, ${entity})`, () => {
    const id = randomUUID();
    db.prepare(
      "insert into records (id, feature, entity, data, created_at) values (?, ?, ?, ?, ?)",
    ).run(id, feature, entity, JSON.stringify(data), new Date().toISOString());
    const row = getRow(id);
    if (!row) throw new Error("failed to create record");
    return toRecord(row);
  });

// Flip a boolean field inside the JSON data and return the updated record.
export const toggleField = (id: string, field: string): StoredRecord | null =>
  timeSync("DB", `toggleField(${field})`, () => {
    const row = getRow(id);
    if (!row) return null;
    const data = JSON.parse(row.data) as Record<string, unknown>;
    const next = { ...data, [field]: !Boolean(data[field]) };
    db.prepare("update records set data = ? where id = ?").run(
      JSON.stringify(next),
      id,
    );
    const updated = getRow(id);
    return updated ? toRecord(updated) : null;
  });

export const deleteRecord = (id: string): void =>
  timeSync("DB", "deleteRecord", () => {
    db.prepare("delete from records where id = ?").run(id);
  });
