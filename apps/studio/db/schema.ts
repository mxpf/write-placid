import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    path: text("path").notNull().unique(),
    type: text("type", { enum: ["post", "page", "now"] }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    date: text("date").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    publishedAt: text("published_at").notNull().default(""),
    publicUpdatedAt: text("public_updated_at").notNull().default(""),
    body: text("body").notNull().default(""),
    sourceLabel: text("source_label").notNull().default(""),
    sourceHref: text("source_href").notNull().default(""),
    remoteSha: text("remote_sha").notNull().default(""),
    publishedSource: text("published_source").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    googleDocId: text("google_doc_id").notNull().default(""),
    driveRevision: text("drive_revision").notNull().default(""),
    driveSyncedBody: text("drive_synced_body").notNull().default(""),
  },
  (table) => [
    index("idx_documents_type_status_date").on(
      table.type,
      table.status,
      table.date,
    ),
  ],
);

export const deletedDocuments = sqliteTable("deleted_documents", {
  id: text("id").primaryKey(),
  documentJson: text("document_json").notNull(),
  deletedAt: text("deleted_at").notNull(),
});
