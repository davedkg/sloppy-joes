// M4: lightweight local persistence (SQLite via better-sqlite3).
// Schemaless-ish: every entity is a JSON `data` blob in one `records` table,
// tagged by feature + entity. Works for any feature without per-model DDL.

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { log } from "./log";

const dbPath =
  process.env.SLOPPY_DB ?? path.join(process.cwd(), "data", "sloppy.db");
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
  log(`database ready at ${dbPath}`);
};

export const listRecords = (
  feature: string,
  entity?: string,
): StoredRecord[] => {
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
};

export const createRecord = (
  feature: string,
  entity: string,
  data: Record<string, unknown>,
): StoredRecord => {
  const id = randomUUID();
  db.prepare(
    "insert into records (id, feature, entity, data) values (?, ?, ?, ?)",
  ).run(id, feature, entity, JSON.stringify(data));
  const row = db.prepare("select * from records where id = ?").get(id) as
    | Row
    | undefined;
  if (!row) throw new Error("failed to create record");
  return toRecord(row);
};

// Flip a boolean field inside the JSON data (e.g. a todo's `done`).
export const toggleField = (id: string, field: string): void => {
  const row = db.prepare("select data from records where id = ?").get(id) as
    | { data: string }
    | undefined;
  if (!row) return;
  const data = JSON.parse(row.data) as Record<string, unknown>;
  const next = { ...data, [field]: !Boolean(data[field]) };
  db.prepare("update records set data = ? where id = ?").run(
    JSON.stringify(next),
    id,
  );
};

export const deleteRecord = (id: string): void => {
  db.prepare("delete from records where id = ?").run(id);
};
