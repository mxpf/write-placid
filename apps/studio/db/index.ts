import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1() {
  if (!env.DB) {
    throw new Error("Write Placid Studio storage is unavailable.");
  }
  return env.DB;
}

export async function ensureSchema() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        path TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        published_at TEXT NOT NULL DEFAULT '',
        public_updated_at TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        source_label TEXT NOT NULL DEFAULT '',
        source_href TEXT NOT NULL DEFAULT '',
        remote_sha TEXT NOT NULL DEFAULT '',
        published_source TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        google_doc_id TEXT NOT NULL DEFAULT '',
        drive_revision TEXT NOT NULL DEFAULT '',
        drive_synced_body TEXT NOT NULL DEFAULT ''
      )
    `),
    d1.prepare(`
      CREATE INDEX IF NOT EXISTS idx_documents_type_status_date
      ON documents(type, status, date)
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS deleted_documents (
        id TEXT PRIMARY KEY NOT NULL,
        document_json TEXT NOT NULL,
        deleted_at TEXT NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )
    `),
  ]);
  const columns = await d1.prepare("PRAGMA table_info(documents)").all<{ name: string }>();
  const names = new Set((columns.results || []).map((column) => column.name));
  const additions = [
    ["google_doc_id", "TEXT NOT NULL DEFAULT ''"],
    ["drive_revision", "TEXT NOT NULL DEFAULT ''"],
    ["drive_synced_body", "TEXT NOT NULL DEFAULT ''"],
    ["public_updated_at", "TEXT NOT NULL DEFAULT ''"],
  ] as const;
  for (const [name, definition] of additions) {
    if (!names.has(name)) {
      await d1.prepare(`ALTER TABLE documents ADD COLUMN ${name} ${definition}`).run();
    }
  }
  await d1.prepare("PRAGMA optimize").run();
}
