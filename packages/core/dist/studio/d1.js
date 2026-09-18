const selectColumns = "id,path,type,slug,editorial_json,title,date,status,published_at,public_updated_at,body,source_label,source_href,remote_sha,published_source,updated_at,sort_order,google_doc_id,drive_revision,drive_synced_body";
const insertSql = `INSERT INTO documents (${selectColumns}) VALUES (${Array(20).fill("?").join(",")}) ON CONFLICT(id) DO UPDATE SET path=excluded.path,type=excluded.type,slug=excluded.slug,editorial_json=excluded.editorial_json,title=excluded.title,date=excluded.date,status=excluded.status,published_at=excluded.published_at,public_updated_at=excluded.public_updated_at,body=excluded.body,source_label=excluded.source_label,source_href=excluded.source_href,remote_sha=excluded.remote_sha,published_source=excluded.published_source,updated_at=excluded.updated_at,google_doc_id=excluded.google_doc_id,drive_revision=excluded.drive_revision,drive_synced_body=excluded.drive_synced_body`;
const insertDoNothingSql = `INSERT INTO documents (${selectColumns}) VALUES (${Array(20).fill("?").join(",")}) ON CONFLICT(id) DO NOTHING`;
const replaceSql = `${insertSql},sort_order=excluded.sort_order`;
/** D1 persistence with request-time binding lookup and injected private document mapping. */
export function createD1Store(options) {
    const mapGoogleDoc = options.mappedGoogleDocId || (() => "");
    const now = options.now || (() => new Date().toISOString());
    let schemaReady;
    const getD1 = options.getD1;
    async function initializeSchema() {
        const db = getD1();
        await db.batch([
            db.prepare(`CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY NOT NULL,path TEXT NOT NULL UNIQUE,type TEXT NOT NULL,slug TEXT NOT NULL,title TEXT NOT NULL,date TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,published_at TEXT NOT NULL DEFAULT '',public_updated_at TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',source_label TEXT NOT NULL DEFAULT '',source_href TEXT NOT NULL DEFAULT '',remote_sha TEXT NOT NULL DEFAULT '',published_source TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,google_doc_id TEXT NOT NULL DEFAULT '',drive_revision TEXT NOT NULL DEFAULT '',drive_synced_body TEXT NOT NULL DEFAULT '',editorial_json TEXT NOT NULL DEFAULT '{}')`),
            db.prepare("CREATE INDEX IF NOT EXISTS idx_documents_type_status_date ON documents(type,status,date)"),
            db.prepare("CREATE TABLE IF NOT EXISTS deleted_documents (id TEXT PRIMARY KEY NOT NULL,document_json TEXT NOT NULL,deleted_at TEXT NOT NULL)"),
            db.prepare("CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL)"),
        ]);
        const columns = await db.prepare("PRAGMA table_info(documents)").all();
        const names = new Set((columns.results || []).map((column) => column.name));
        for (const [name, definition] of [["google_doc_id", "TEXT NOT NULL DEFAULT ''"], ["drive_revision", "TEXT NOT NULL DEFAULT ''"], ["drive_synced_body", "TEXT NOT NULL DEFAULT ''"], ["editorial_json", "TEXT NOT NULL DEFAULT '{}'"], ["public_updated_at", "TEXT NOT NULL DEFAULT ''"]]) {
            if (!names.has(name))
                await db.prepare(`ALTER TABLE documents ADD COLUMN ${name} ${definition}`).run();
        }
        await db.prepare("PRAGMA optimize").run();
    }
    async function ensureSchema() { schemaReady ||= initializeSchema().catch((error) => { schemaReady = undefined; throw error; }); await schemaReady; }
    function fromRow(row) {
        const path = String(row.path);
        return { ...JSON.parse(String(row.editorial_json || "{}")), id: String(row.id), path, type: row.type, slug: String(row.slug), title: String(row.title), date: String(row.date), status: row.status, publishedAt: String(row.published_at), publicUpdatedAt: String(row.public_updated_at), body: String(row.body), source: row.source_label && row.source_href ? { label: String(row.source_label), href: String(row.source_href) } : undefined, remoteSha: String(row.remote_sha), publishedSource: String(row.published_source), updatedAt: String(row.updated_at), googleDocId: String(row.google_doc_id || mapGoogleDoc(path)), driveRevision: String(row.drive_revision), driveSyncedBody: String(row.drive_synced_body) };
    }
    function values(document, sortOrder = 0) {
        return [document.id, document.path, document.type, document.slug, JSON.stringify({ publicPath: document.publicPath, legacyIds: document.legacyIds || [], aliases: document.aliases || [], kdrivePath: document.kdrivePath, kdriveEtag: document.kdriveEtag, identityPersisted: document.identityPersisted, metadata: document.metadata }), document.title, document.date, document.status, document.publishedAt, document.publicUpdatedAt, document.body, document.source?.label || "", document.source?.href || "", document.remoteSha, document.publishedSource, document.updatedAt, sortOrder, document.googleDocId || mapGoogleDoc(document.path), document.driveRevision, document.driveSyncedBody];
    }
    async function listDocuments() { await ensureSchema(); const rows = await getD1().prepare(`SELECT ${selectColumns} FROM documents ORDER BY type ASC,sort_order ASC,date DESC`).all(); return (rows.results || []).map(fromRow); }
    async function findDocument(id) { await ensureSchema(); const row = await getD1().prepare(`SELECT ${selectColumns} FROM documents WHERE id=? LIMIT 1`).bind(id).first(); if (row)
        return fromRow(row); const aliases = (await listDocuments()).filter((document) => document.legacyIds?.includes(id)); if (aliases.length > 1)
        throw new Error(`Legacy identity collision: ${id}`); return aliases[0]; }
    async function findDocumentByPath(path) { await ensureSchema(); const row = await getD1().prepare(`SELECT ${selectColumns} FROM documents WHERE path=? LIMIT 1`).bind(path).first(); return row ? fromRow(row) : undefined; }
    async function saveDocument(document, sortOrder = 0) { await ensureSchema(); await getD1().prepare(insertSql).bind(...values(document, sortOrder)).run(); return document; }
    async function cacheDocuments(items) { if (!items.length)
        return; await ensureSchema(); await getD1().batch(items.map((document) => getD1().prepare(insertSql).bind(...values(document)))); }
    async function replaceDocument(previousId, document, sortOrder = 0) { await ensureSchema(); const current = await getD1().prepare("SELECT sort_order FROM documents WHERE id=? LIMIT 1").bind(previousId).first(); await getD1().batch([getD1().prepare("DELETE FROM documents WHERE id=?").bind(previousId), getD1().prepare(replaceSql).bind(...values(document, current?.sort_order ?? sortOrder))]); return document; }
    async function reorderDraftDocuments(ids) { await ensureSchema(); const rows = await getD1().prepare("SELECT id,type,status FROM documents").all(); const draftIds = (rows.results || []).filter((row) => row.type === "post" && row.status === "draft").map((row) => row.id); const unique = new Set(ids); if (unique.size !== ids.length || ids.length !== draftIds.length || draftIds.some((id) => !unique.has(id)))
        throw new Error("The draft list changed. Reload Studio and try again."); if (ids.length)
        await getD1().batch(ids.map((id, order) => getD1().prepare("UPDATE documents SET sort_order=? WHERE id=?").bind(order, id))); }
    async function seedDocuments(items) { await ensureSchema(); if (items.length)
        await getD1().batch(items.map((document, index) => getD1().prepare(insertDoNothingSql).bind(...values(document, index)))); }
    async function deleteDocument(id) { const document = await findDocument(id); if (!document)
        return; const deletedAt = now(); await getD1().batch([getD1().prepare("INSERT INTO deleted_documents (id,document_json,deleted_at) VALUES (?,?,?)").bind(`${deletedAt}:${document.id}`, JSON.stringify(document), deletedAt), getD1().prepare("DELETE FROM documents WHERE id=?").bind(document.id)]); return document; }
    async function getSyncCursor(key) { await ensureSchema(); const result = await getD1().prepare("SELECT value FROM sync_state WHERE key=?").bind(key).first(); const cursor = Number.parseInt(result?.value || "0", 10); return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0; }
    async function setSyncCursor(key, cursor) { await ensureSchema(); await getD1().prepare("INSERT INTO sync_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, String(cursor)).run(); }
    return { ensureSchema, listDocuments, findDocument, findDocumentByPath, saveDocument, cacheDocuments, replaceDocument, reorderDraftDocuments, seedDocuments, deleteDocument, getSyncCursor, setSyncCursor };
}
//# sourceMappingURL=d1.js.map