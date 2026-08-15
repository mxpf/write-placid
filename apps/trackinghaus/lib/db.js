import { neon } from "@neondatabase/serverless";

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

let sqlClient = null;
let schemaPromise = null;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new ConfigurationError("DATABASE_URL is not configured");
  }
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function ensureSchema() {
  if (!schemaPromise) {
    const sql = getSql();
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS trackinghaus_daily (
        site_key TEXT NOT NULL,
        day DATE NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        reads INTEGER NOT NULL DEFAULT 0,
        returning_reads INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (site_key, day, path, source)
      )
    `;
  }
  return schemaPromise;
}

export async function recordRead({ site, day, path, title, source, returning }) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO trackinghaus_daily (
      site_key, day, path, title, source, reads, returning_reads
    ) VALUES (
      ${site}, ${day}, ${path}, ${title}, ${source}, 1, ${returning ? 1 : 0}
    )
    ON CONFLICT (site_key, day, path, source)
    DO UPDATE SET
      title = EXCLUDED.title,
      reads = trackinghaus_daily.reads + 1,
      returning_reads = trackinghaus_daily.returning_reads + EXCLUDED.returning_reads,
      updated_at = NOW()
  `;
}

export async function getAggregateRows({ site, start, end }) {
  await ensureSchema();
  const sql = getSql();
  return sql`
    SELECT
      day::text AS day,
      path,
      MAX(title) AS title,
      source,
      SUM(reads)::int AS reads,
      SUM(returning_reads)::int AS returning_reads
    FROM trackinghaus_daily
    WHERE site_key = ${site}
      AND day BETWEEN ${start}::date AND ${end}::date
    GROUP BY day, path, source
    ORDER BY day ASC, path ASC
  `;
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
