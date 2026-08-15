import { asc, desc, eq } from "drizzle-orm";
import type { WritingDocument } from "../app/content";
import { getD1, getDb, ensureSchema } from ".";
import { documents } from "./schema";
import { mappedGoogleDocId } from "../app/drive-document-map";

type DocumentRow = typeof documents.$inferSelect;

function fromRow(row: DocumentRow): WritingDocument {
  return {
    id: row.id,
    path: row.path,
    type: row.type,
    slug: row.slug,
    title: row.title,
    date: row.date,
    status: row.status,
    publishedAt: row.publishedAt,
    body: row.body,
    source:
      row.sourceLabel && row.sourceHref
        ? { label: row.sourceLabel, href: row.sourceHref }
        : undefined,
    remoteSha: row.remoteSha,
    publishedSource: row.publishedSource,
    updatedAt: row.updatedAt,
    googleDocId: row.googleDocId || mappedGoogleDocId(row.path),
    driveRevision: row.driveRevision,
    driveSyncedBody: row.driveSyncedBody,
  };
}

function toRow(document: WritingDocument, sortOrder = 0) {
  return {
    id: document.id,
    path: document.path,
    type: document.type,
    slug: document.slug,
    title: document.title,
    date: document.date,
    status: document.status,
    publishedAt: document.publishedAt,
    body: document.body,
    sourceLabel: document.source?.label || "",
    sourceHref: document.source?.href || "",
    remoteSha: document.remoteSha,
    publishedSource: document.publishedSource,
    updatedAt: document.updatedAt,
    sortOrder,
    googleDocId: document.googleDocId || mappedGoogleDocId(document.path),
    driveRevision: document.driveRevision,
    driveSyncedBody: document.driveSyncedBody,
  };
}

export async function listDocuments() {
  await ensureSchema();
  const rows = await getDb()
    .select()
    .from(documents)
    .orderBy(asc(documents.type), desc(documents.date), asc(documents.sortOrder));
  return rows.map(fromRow);
}

export async function findDocument(id: string) {
  await ensureSchema();
  const [row] = await getDb()
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  return row ? fromRow(row) : undefined;
}

export async function findDocumentByPath(path: string) {
  await ensureSchema();
  const [row] = await getDb()
    .select()
    .from(documents)
    .where(eq(documents.path, path))
    .limit(1);
  return row ? fromRow(row) : undefined;
}

export async function saveDocument(document: WritingDocument, sortOrder = 0) {
  await ensureSchema();
  const row = toRow(document, sortOrder);
  await getDb()
    .insert(documents)
    .values(row)
    .onConflictDoUpdate({
      target: documents.id,
      set: row,
    });
  return document;
}

export async function replaceDocument(
  previousId: string,
  document: WritingDocument,
  sortOrder = 0,
) {
  await ensureSchema();
  const db = getDb();
  const row = toRow(document, sortOrder);
  await db.batch([
    db.delete(documents).where(eq(documents.id, previousId)),
    db.insert(documents).values(row).onConflictDoUpdate({
      target: documents.id,
      set: row,
    }),
  ]);
  return document;
}

export async function seedDocuments(items: WritingDocument[]) {
  await ensureSchema();
  const db = getDb();
  for (const [index, document] of items.entries()) {
    const row = toRow(document, index);
    await db
      .insert(documents)
      .values(row)
      .onConflictDoNothing({ target: documents.id });
  }
}

export async function deleteDocument(id: string) {
  const document = await findDocument(id);
  if (!document) return undefined;

  const deletedAt = new Date().toISOString();
  const archiveId = `${deletedAt}:${document.id}`;
  const d1 = getD1();
  await d1.batch([
    d1.prepare(
      "INSERT INTO deleted_documents (id, document_json, deleted_at) VALUES (?, ?, ?)",
    ).bind(archiveId, JSON.stringify(document), deletedAt),
    d1.prepare("DELETE FROM documents WHERE id = ?").bind(document.id),
  ]);
  return document;
}
