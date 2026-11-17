import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { normalizeIncomingDocument } from "../dist/studio/content.js";
import { createD1Store } from "../dist/studio/d1.js";

function database(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  function prepare(sql, values = []) {
    const execute = () => ({ results: sqlite.prepare(sql).all(...values) });
    return {
      bind: (...parameters) => prepare(sql, parameters),
      all: async () => execute(),
      first: async () => sqlite.prepare(sql).get(...values) || null,
      run: async () => execute(),
      execute,
    };
  }
  const d1 = {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sqlite, store: createD1Store({ getD1: () => d1 }) };
}

for (const type of ["post", "now"]) {
  test(`deleting a private ${type} retains one recovery copy and supports retries`, async (t) => {
    const { sqlite, store } = database(t);
    const document = normalizeIncomingDocument({ type, title: "Private test", body: "Keep this recovery text." });
    await store.seedDocuments([document]);
    assert.equal(await store.deletePrivateDraft(document), true);
    assert.equal(await store.findDocument(document.id), undefined);
    const copies = sqlite.prepare("SELECT document_json FROM deleted_documents").all();
    assert.equal(copies.length, 1);
    assert.deepEqual(JSON.parse(copies[0].document_json), JSON.parse(JSON.stringify(document)));
    assert.equal(await store.deletePrivateDraft(document), false);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM deleted_documents").get().count, 1);
  });
}

test("private deletion protects pages and every stored publication marker", async (t) => {
  const { sqlite, store } = database(t);
  for (const [index, changes] of [
    { status: "published" },
    { type: "page", slug: "about", path: "content/pages/about.md", publicPath: "about.md" },
    { publishedAt: "2026-11-01T00:00:00.000Z" },
    { publishedSource: "A previous public snapshot." },
    { remoteSha: "published-git-revision" },
    { aliases: ["/former-address.html"] },
  ].entries()) {
    const document = { ...normalizeIncomingDocument({ title: `Protected piece ${index}` }), ...changes };
    await store.seedDocuments([document]);
    const before = await store.findDocument(document.id);
    assert.equal(await store.deletePrivateDraft(document), false);
    assert.deepEqual(await store.findDocument(document.id), before);
  }
  const revision = normalizeIncomingDocument({ title: "Recorded publication" });
  await store.seedDocuments([revision]);
  sqlite.prepare("UPDATE documents SET editorial_json=json_set(editorial_json,'$.publishedRevision',?) WHERE id=?")
    .run("recorded-public-revision", revision.id);
  assert.equal(await store.deletePrivateDraft(revision), false);
  assert.ok(await store.findDocument(revision.id));
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM deleted_documents").get().count, 0);
});

test("a concurrent save prevents deletion and preserves the latest draft", async (t) => {
  const { sqlite, store } = database(t);
  const original = normalizeIncomingDocument({ title: "Changing draft", body: "Before." });
  await store.seedDocuments([original]);
  const latest = { ...original, body: "Saved elsewhere.", updatedAt: "2030-01-01T00:00:00.000Z" };
  await store.saveDocument(latest);
  assert.equal(await store.deletePrivateDraft(original), false);
  assert.equal((await store.findDocument(original.id)).body, latest.body);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM deleted_documents").get().count, 0);
  assert.equal(await store.deletePrivateDraft(latest), true);
  const recovery = sqlite.prepare("SELECT document_json FROM deleted_documents").get();
  assert.equal(JSON.parse(recovery.document_json).body, latest.body);
});

for (const [operation, table] of [["INSERT", "deleted_documents"], ["DELETE", "documents"]]) {
  test(`a failed ${operation} rolls back private deletion and its recovery copy`, async (t) => {
    const { sqlite, store } = database(t);
    const document = normalizeIncomingDocument({ title: "Recoverable draft", body: "Still safe." });
    await store.seedDocuments([document]);
    sqlite.exec(`CREATE TRIGGER fail_operation BEFORE ${operation} ON ${table}
      BEGIN SELECT RAISE(ABORT, 'operation failed'); END`);
    await assert.rejects(store.deletePrivateDraft(document), /operation failed/);
    assert.equal((await store.findDocument(document.id)).body, document.body);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM deleted_documents").get().count, 0);
  });
}
