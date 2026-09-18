import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIncomingDocument, parseWritingDocument, serializeWritingDocument } from "../app/content.ts";
import { buildPublicSnapshot, validateRepository } from "../app/editorial.ts";
import { planEditorialMigration } from "../app/editorial-migration.ts";
import { editorialLocation, loadKdrivePost, loadKdrivePosts, listKdrivePostRefs, saveKdrivePost, loadKdriveImage } from "../app/kdrive.ts";
import { publishEditorialSnapshot, publishImageAsset } from "../app/github.ts";
import { markdownToEditorHtml } from "../app/rich-text.ts";

const piece = (title, extras = {}) => ({ ...normalizeIncomingDocument({ title, body: "Original body." }), ...extras });
const configureKdrive = () => {
  process.env.WRITE_PLACID_KDRIVE_WEBDAV_URL = "https://kdrive.example";
  process.env.WRITE_PLACID_KDRIVE_ROOT = "/Editorial";
  process.env.WRITE_PLACID_KDRIVE_USERNAME = "test";
  process.env.WRITE_PLACID_KDRIVE_APP_PASSWORD = "test";
};

function inventoryXml(folder, documents) {
  return `<d:multistatus xmlns:d="DAV:">${documents.filter(document => document.kdrivePath.startsWith(`${folder}/`)).map(document => `<d:response><d:href>/Editorial/${document.kdrivePath}</d:href><d:getetag>${document.kdriveEtag}</d:getetag></d:response>`).join("")}</d:multistatus>`;
}

test("fresh KDrive inventory reuses only exact cached revisions and omits removed files", async (t) => {
  configureKdrive();
  const unchanged = piece("Unchanged", { kdrivePath: "Drafts/unchanged.md", kdriveEtag: "v1" });
  const changed = piece("Changed", { kdrivePath: "Drafts/changed.md", kdriveEtag: "v1" });
  const moved = piece("Moved", { kdrivePath: "Drafts/moved.md", kdriveEtag: "v1" });
  const removed = piece("Removed", { kdrivePath: "Drafts/removed.md", kdriveEtag: "v1" });
  const remote = [unchanged, { ...changed, body: "External writing", kdriveEtag: "v2" }, { ...moved, status: "published", kdrivePath: "Published/moved.md" }];
  const reads = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const relative = new URL(url).pathname.replace("/Editorial/", "");
    if (init.method === "PROPFIND") return new Response(inventoryXml(relative, remote));
    reads.push(relative);
    const document = remote.find(item => item.kdrivePath === relative);
    assert.equal(init.headers["If-Match"], document.kdriveEtag);
    return new Response(serializeWritingDocument(document));
  });
  const result = await loadKdrivePosts([unchanged, changed, moved, removed]);
  assert.equal(result.length, 3);
  assert.deepEqual(reads.sort(), ["Drafts/changed.md", "Published/moved.md"]);
  assert.equal(result.find(item => item.id === changed.id).body, "External writing");
  assert.equal(result.find(item => item.id === moved.id).status, "published");
  assert.notEqual(result.find(item => item.id === unchanged.id), unchanged);
  const { withEditBase, validateSaveRevision } = await import("../app/save-state.ts");
  assert.match(validateSaveRevision(withEditBase(changed), result.find(item => item.id === changed.id)), /different writing/);
});

test("a warm editorial library can validate, save and export images under a 50-subrequest budget", async (t) => {
  configureKdrive();
  process.env.WRITE_PLACID_GITHUB_TOKEN = "test";
  process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION = "1";
  const cached = Array.from({ length: 60 }, (_, index) => piece(`Piece ${index}`, { status: "published", kdrivePath: `Published/piece-${index}.md`, kdriveEtag: `v${index}` }));
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (++requests > 50) throw new Error("Too many subrequests by single Worker invocation");
    const path = new URL(url).pathname;
    if (new URL(url).hostname === "kdrive.example") {
      if (init.method === "PROPFIND") return new Response(inventoryXml(path.replace("/Editorial/", ""), cached));
      if (init.method === "MKCOL") return new Response(null, { status: 405 });
      if (init.method === "PUT") { assert.equal(init.headers["If-Match"], "v0"); return new Response(null, { headers: { ETag: "saved" } }); }
      if (path.includes("/Images/")) return new Response(new Uint8Array([1, 2, 3]));
      const document = cached.find(item => `/Editorial/${item.kdrivePath}` === path);
      return new Response(serializeWritingDocument(document));
    }
    if (path.includes("/contents/")) return init.method === "PUT" ? Response.json({}) : new Response(null, { status: 404 });
    if (path.includes("/git/ref/heads/")) return Response.json({ object: { sha: "head" } });
    if (path.endsWith("/git/commits/head")) return Response.json({ tree: { sha: "old-tree" } });
    if (path.endsWith("/git/trees/old-tree")) return Response.json({ tree: [], truncated: false });
    if (path.endsWith("/git/trees")) return Response.json({ sha: "new-tree" });
    if (path.endsWith("/git/commits")) return Response.json({ sha: "new-commit" });
    if (path.includes("/git/refs/heads/")) return Response.json({});
    assert.fail(`Unexpected request: ${path}`);
  });
  await assert.rejects(loadKdrivePosts(), /Too many subrequests/);
  requests = 0;
  const repository = await loadKdrivePosts(cached);
  assert.deepEqual(validateRepository(repository), []);
  const changed = { ...repository[0], body: "New writing and a caption." };
  await saveKdrivePost(changed, repository[0]);
  for (const name of ["one.png", "two.png", "three.png"]) {
    const image = await loadKdriveImage(name);
    await publishImageAsset(name, image.bytes);
  }
  await publishEditorialSnapshot(repository.map(item => item.id === changed.id ? changed : item));
  assert.ok(requests <= 25, `Expected headroom for redirects and D1, used ${requests}`);
});

test("a failed inventory never falls back to stale cached writing", async (t) => {
  configureKdrive();
  t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(loadKdrivePosts([piece("Cached", { kdrivePath: "Drafts/cached.md", kdriveEtag: "v1" })]), /503/);
});

test("identity and public filename survive title changes, folder moves, and explicit slug changes", () => {
  const original = piece("Original", { kdrivePath: "Drafts/Notes/file.md" });
  const titled = normalizeIncomingDocument({ ...original, title: "New title" }, original);
  assert.equal(titled.slug, original.slug);
  const changed = normalizeIncomingDocument({ ...titled, slug: "new-address", status: "published" }, titled);
  assert.equal(changed.id, original.id);
  assert.equal(changed.path, original.path);
  assert.deepEqual(changed.aliases, ["/original.html"]);
  assert.equal(editorialLocation(changed), "Published/Notes/file.md");
  const reread = parseWritingDocument(serializeWritingDocument(changed), "content/posts/renamed-file.md");
  assert.equal(reread.id, original.id);
  assert.equal(reread.path, original.path);
  assert.equal(reread.slug, "new-address");
  assert.deepEqual(reread.aliases, ["/original.html"]);
});

test("JSON escaped titles and extension metadata survive serialization", () => {
  const original = piece('A "quoted" title', { metadata: { category: "Writing" } });
  const parsed = parseWritingDocument(serializeWritingDocument(original), original.path);
  assert.equal(parsed.title, original.title);
  assert.deepEqual(parsed.metadata, original.metadata);
});

test("validates duplicate IDs, public slugs across types, and snapshot paths", () => {
  const first = piece("First");
  assert.match(validateRepository([first, piece("Second", { id: first.id })]).join(), /Duplicate ID/);
  assert.match(validateRepository([first, piece("Second", { type: "page", slug: first.slug })]).join(), /Duplicate slug/);
  assert.match(validateRepository([first, piece("Second", { path: first.path })]).join(), /Duplicate snapshot path/);
  assert.match(validateRepository([piece("Now")]).join(), /Reserved public URL/);
});

test("validates alias ownership, collisions, unsafe paths, and redirect loops", () => {
  const a = piece("A", { aliases: ["/b.html"] });
  const b = piece("B", { aliases: ["/a.html"] });
  assert.match(validateRepository([a, b]).join(), /Alias collision/);
  assert.match(validateRepository([a, b]).join(), /Redirect loop/);
  assert.match(validateRepository([piece("A", { aliases: ["//external.html"] })]).join(), /Invalid alias/);
  assert.match(validateRepository([piece("A", { path: "../../outside.md" })]).join(), /Invalid snapshot path/);
  assert.match(validateRepository([piece("A", { aliases: ["/old.html"] }), piece("B", { aliases: ["/old.html"] })]).join(), /Alias collision/);
});

test("validates references across the whole repository including private targets", () => {
  const target = piece("Target");
  assert.match(validateRepository([piece("Missing", { body: "[link](doc:unknown)" })]).join(), /Unresolved internal reference/);
  const source = piece("Source", { status: "published", body: `[link](doc:${target.id})` });
  assert.match(validateRepository([source, target]).join(), /references private document/);
  assert.equal(validateRepository([{ ...source, status: "draft" }, target]).length, 0);
});

test("snapshot contains published content only and resolves ID links against stable URLs", () => {
  const target = piece("Target", { legacyIds: ["content/posts/legacy.md"], status: "published", aliases: ["/former.html"] });
  const source = piece("Source", { status: "published", body: `[link](doc:${encodeURIComponent(target.id)}#section)` });
  const secret = piece("Secret");
  const snapshot = buildPublicSnapshot([source, target, secret]);
  assert.equal(snapshot.manifest.version, 1);
  assert.equal(snapshot.manifest.documents.length, 2);
  assert.equal(snapshot.manifest.redirects["/former.html"], "/target.html");
  assert.equal(snapshot.files[secret.path], undefined);
  assert.match(snapshot.files[source.path], /\[link\]\(\/target.html#section\)/);
  assert.doesNotMatch(JSON.stringify(snapshot), /Original body.*Secret/);
  assert.match(markdownToEditorHtml(source.body), /href="doc:/);
});

test("multiple Now entries share the aggregate URL without slug collisions", () => {
  const one = piece("First", { type: "now", path: "content/now/first.md", status: "published" });
  const two = piece("Second", { type: "now", path: "content/now/second.md", status: "published" });
  assert.equal(validateRepository([one, two]).length, 0);
  assert.deepEqual(buildPublicSnapshot([one, two]).manifest.documents.map((item) => item.url), ["/now.html", "/now.html"]);
});

test("migration adopts deployed UUIDs and preserves drafts, provenance, and published content", () => {
  const legacy = parseWritingDocument('---\ntitle: "Existing"\nslug: existing\ndate: 2026-01-01\nstatus: published\n---\n\nOld body.', "content/posts/existing.md");
  const canonical = { ...legacy, kdrivePath: "Published/existing.md", kdriveEtag: '"1"' };
  const live = { ...legacy, id: crypto.randomUUID(), identityPersisted: true, body: "Deployed body.", aliases: ["/old-address.html"] };
  const draft = parseWritingDocument('---\ntitle: "Remaining answerable"\nslug: remaining-answerable-v3\nstatus: draft\n---\nDraft.', "content/posts/Remaining answerable v3.md");
  const plan = planEditorialMigration([canonical], [legacy, draft], [live]);
  assert.equal(plan.documents.length, 2);
  assert.equal(plan.documents[0].id, live.id);
  assert.equal(plan.documents[0].body, live.body);
  assert.equal(plan.documents[0].path, legacy.path);
  assert.equal(plan.documents[0].publicPath, "existing.md");
  assert.deepEqual(plan.documents[0].legacyIds, [legacy.id]);
  assert.deepEqual(plan.documents[0].aliases, live.aliases);
  assert.match(plan.documents[1].id, /^[a-f0-9-]{36}$/);
  assert.equal(plan.documents[1].path, "content/posts/remaining-answerable-v3.md");
  assert.equal(plan.documents[1].body, draft.body);
  assert.ok(plan.documents[1].legacyIds.includes(draft.id));
  assert.equal(plan.differences.length, 2);
  assert.deepEqual(plan.warnings, []);
  const rerun = planEditorialMigration([canonical], [legacy, draft], [live], { draftIds: plan.draftIds });
  assert.deepEqual(rerun.documents.map((item) => item.id), plan.documents.map((item) => item.id));
});

test("migration detects ambiguous copies and preserves conflicting bodies in backup", () => {
  const old = piece("Old");
  const canonical = { ...old, body: "Different KDrive content", kdrivePath: "Drafts/old.md" };
  const plan = planEditorialMigration([canonical], [old], []);
  assert.equal(plan.warnings.length, 1);
  assert.equal(plan.backup.cached[0].body, "Original body.");
  assert.throws(() => planEditorialMigration([canonical, { ...canonical, kdrivePath: "Published/copy.md" }], [old], []), /Multiple documents claim/);
});

test("KDrive reads take status from folder and retain frontmatter identity", async (t) => {
  configureKdrive();
  const original = piece("Original", { status: "draft" });
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.headers["If-Match"], '"etag"');
    return new Response(serializeWritingDocument(original));
  });
  const loaded = await loadKdrivePost({ folder: "Published/Nested", type: "post", status: "published", name: "renamed.md", etag: '"etag"' });
  assert.equal(loaded.status, "published");
  assert.equal(loaded.id, original.id);
  assert.equal(loaded.path, original.path);
  assert.equal(loaded.kdrivePath, "Published/Nested/renamed.md");
});

test("recursive WebDAV inventory includes nested editorial files and ignores Research", async (t) => {
  configureKdrive();
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = new URL(url).pathname;
    requests.push(path);
    if (path === "/Editorial/Drafts") return new Response('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/Editorial/Drafts/</d:href><d:collection/></d:response><d:response><d:href>/Editorial/Drafts/Nested/</d:href><d:collection/></d:response></d:multistatus>');
    if (path === "/Editorial/Drafts/Nested") return new Response('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/Editorial/Drafts/Nested/note.md</d:href><d:getetag>&quot;2&quot;</d:getetag></d:response></d:multistatus>');
    return new Response("", { status: 404 });
  });
  const refs = await listKdrivePostRefs();
  assert.equal(refs.length, 1);
  assert.equal(refs[0].folder, "Drafts/Nested");
  assert.equal(refs[0].etag, '"2"');
  assert.ok(!requests.some((path) => path.includes("Research")));
});

test("folder moves forbid overwrites and use the moved file's revision for saving", async (t) => {
  configureKdrive();
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url, ...init });
    return new Response(null, { status: init.method === "MKCOL" ? 405 : 200, headers: { ETag: '"moved"' } });
  });
  const previous = piece("Old", { kdrivePath: "Drafts/Nested/name.md", kdriveEtag: '"old"' });
  const document = { ...previous, status: "published" };
  await saveKdrivePost(document, previous);
  const move = requests.find((request) => request.method === "MOVE");
  assert.equal(move.headers.Overwrite, "F");
  assert.equal(move.headers["If-Match"], '"old"');
  assert.equal(requests.find((request) => request.method === "PUT").headers["If-Match"], '"moved"');
  assert.equal(document.kdrivePath, "Published/Nested/name.md");
  assert.equal(document.id, previous.id);
});

test("stale writes fail without DELETE and new documents cannot overwrite files", async (t) => {
  configureKdrive();
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requests.push(init);
    return new Response(null, { status: init.method === "MKCOL" ? 405 : 412 });
  });
  await assert.rejects(saveKdrivePost(piece("New")), /412/);
  assert.equal(requests.find((request) => request.method === "PUT").headers["If-None-Match"], "*");
  assert.ok(!requests.some((request) => request.method === "DELETE"));
});

test("publishing is gated before any GitHub mutation", async (t) => {
  delete process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION;
  t.mock.method(globalThis, "fetch", () => { throw new Error("unexpected request"); });
  await assert.rejects(publishEditorialSnapshot([piece("A")]), /contract v1/);
});

test("Git snapshot publishes content, removals and redirects in one non-force commit", async (t) => {
  process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION = "1";
  process.env.WRITE_PLACID_GITHUB_TOKEN = "test";
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url, ...init });
    const path = new URL(url).pathname;
    let response;
    if (path.includes("/git/ref/")) response = { object: { sha: "head" } };
    else if (path.endsWith("/git/commits/head")) response = { tree: { sha: "tree" } };
    else if (path.endsWith("/git/trees/tree")) response = { truncated: false, tree: [{ path: "apps/site/content/posts/removed.md", type: "blob", sha: "old" }, { path: "apps/site/app/page.tsx", type: "blob", sha: "code" }] };
    else if (path.endsWith("/git/trees")) response = { sha: "new-tree" };
    else if (path.endsWith("/git/commits")) response = { sha: "new-commit" };
    else response = {};
    return Response.json(response);
  });
  const document = piece("A", { status: "published", aliases: ["/old.html"] });
  const result = await publishEditorialSnapshot([document, piece("Removed", { path: "content/posts/removed.md" })]);
  assert.equal(result.commit, "new-commit");
  const tree = JSON.parse(requests.find((item) => item.url.endsWith("/git/trees")).body);
  assert.equal(tree.base_tree, "tree");
  assert.ok(tree.tree.some((item) => item.path === "apps/site/content/identity-manifest.json"));
  assert.ok(tree.tree.some((item) => item.path === "apps/site/content/posts/removed.md" && item.sha === null));
  assert.ok(!tree.tree.some((item) => item.path === "apps/site/app/page.tsx"));
  assert.deepEqual(JSON.parse(requests.at(-1).body), { sha: "new-commit", force: false });
  assert.equal(document.id.length, 36);
  assert.match(document.publishedSource, /^id:/m);
});

test("published path, slug and aliases override a cached pending rename", () => {
  const live = piece("Old", { status: "published", aliases: ["/former.html"] });
  const cached = { ...live, slug: "new", path: "content/posts/new.md" };
  const canonical = { ...cached, id: "content/posts/new.md", identityPersisted: false, kdrivePath: "Published/new.md", legacyIds: [live.id] };
  const plan = planEditorialMigration([canonical], [cached], [live]);
  assert.equal(plan.documents[0].id, live.id);
  assert.equal(plan.documents[0].path, live.path);
  assert.equal(plan.documents[0].slug, "old");
  assert.deepEqual(plan.documents[0].aliases, ["/former.html"]);
});

test("malformed or duplicate identity frontmatter is rejected", () => {
  assert.throws(() => parseWritingDocument('---\nid: one\nid: two\nslug: test\n---\nBody', "content/posts/test.md"), /Duplicate frontmatter field/);
  assert.throws(() => parseWritingDocument('---\ncustom:\n  nested: value\n---\nBody', "content/posts/test.md"), /one field per line/);
});

test("missing canonical identity cannot delete a historical public file", async (t) => {
  process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION = "1";
  process.env.WRITE_PLACID_GITHUB_TOKEN = "test";
  const mutations = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (init.method) mutations.push(init.method);
    if (url.includes("/git/ref/")) return Response.json({ object: { sha: "head" } });
    if (url.includes("/git/commits/")) return Response.json({ tree: { sha: "tree" } });
    return Response.json({ tree: [{ path: "apps/site/content/posts/historical.md", type: "blob" }], truncated: false });
  });
  await assert.rejects(publishEditorialSnapshot([]), /no canonical KDrive identity/);
  assert.deepEqual(mutations, []);
});

test("an edit arriving during a folder move is not overwritten", async (t) => {
  configureKdrive();
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push(init.method);
    if (init.method === "MKCOL") return new Response(null, { status: 405 });
    if (init.method === "GET") return new Response(url.includes("/Published/") ? "Someone else's new edit" : "Original source", { headers: { ETag: '"changed"' } });
    return new Response(null, { status: 201 });
  });
  const previous = piece("Old", { kdrivePath: "Drafts/old.md", kdriveEtag: '"old"' });
  await assert.rejects(saveKdrivePost({ ...previous, status: "published" }, previous), /moved file changed/);
  assert.ok(requests.includes("MOVE"));
  assert.ok(!requests.includes("PUT"));
});

test("migration resolves legacy links and excludes explicit public draft status from publication", () => {
  const draft = piece("Held", { status: "draft" });
  const wrong = { ...draft, id: "content/posts/held.md", status: "published", kdrivePath: "Published/held.md", identityPersisted: false };
  assert.throws(() => planEditorialMigration([wrong], [wrong], [draft]), /status disagrees/);
  const source = { ...piece("Source"), id: "content/posts/source.md", identityPersisted: false, body: "[Held](doc:content%2Fposts%2Fheld.md)", kdrivePath: "Drafts/source.md" };
  const plan = planEditorialMigration([wrong, source], [wrong], [draft], { publicStatusAuthority: [draft.id] });
  assert.equal(plan.documents[0].status, "draft");
  assert.equal(plan.documents[0].id, draft.id);
  assert.match(plan.documents[1].body, new RegExp(draft.id));
  assert.equal(buildPublicSnapshot(plan.documents).manifest.documents.length, 0);
});

test("bare public filenames are derived into a checked type directory", () => {
  const doc = piece("Safe");
  assert.equal(parseWritingDocument(serializeWritingDocument(doc), doc.path).path, "content/posts/safe.md");
  assert.match(serializeWritingDocument(doc), /^publicPath: "safe.md"$/m);
  assert.throws(() => buildPublicSnapshot([{ ...doc, publicPath: "../../outside.md" }]), /Invalid public filename/);
  assert.match(validateRepository([{ ...doc, legacyIds: ["legacy"] }, { ...piece("Other"), legacyIds: ["legacy"] }]).join(), /Legacy ID collision/);
});

test("legacy identity provenance stays private at the public handoff", () => {
  const document = piece("A", { status: "published", legacyIds: ["content/posts/a.md"] });
  const snapshot = buildPublicSnapshot([document]);
  assert.match(serializeWritingDocument(document), /^legacyIds:/m);
  assert.doesNotMatch(snapshot.files[document.path], /^legacyIds:/m);
});

test("save acknowledgements retain in-flight edits and advance the revision", async () => {
  const { acknowledgeSave, validateSaveRevision } = await import("../app/save-state.ts");
  const saving = piece("A", { kdriveEtag: '"first"' });
  const saved = { ...saving, kdriveEtag: '"second"', kdrivePath: "Drafts/a.md" };
  const latest = { ...saving, title: "Typed meanwhile", body: "New text" };
  const next = acknowledgeSave(latest, saving, saved);
  assert.equal(next.title, latest.title);
  assert.equal(next.body, latest.body);
  assert.equal(next.kdriveEtag, saved.kdriveEtag);
  assert.equal(validateSaveRevision(next, saved), null);
  assert.match(validateSaveRevision(saving, saved), /changed since/);
  assert.match(validateSaveRevision({ id: saved.id }, undefined), /no longer exists/);
  assert.match(validateSaveRevision({ ...saved, kdriveEtag: undefined }, saved), /changed since/);
});

test("a publishing timestamp or changed ETag does not conflict with unchanged authoring content", async () => {
  const { withEditBase, validateSaveRevision } = await import("../app/save-state.ts");
  const opened = withEditBase(piece("Published", { status: "published", kdriveEtag: "before" }));
  const published = { ...opened, publicUpdatedAt: "2026-09-17T17:25:55Z", publishedAt: "2026-09-12T04:44:56Z", kdriveEtag: "after" };
  assert.equal(validateSaveRevision({ ...opened, body: "My next edit." }, published), null);
  for (const changed of [{ body: "Someone else's edit" }, { title: "Renamed elsewhere" }, { status: "draft" }, { slug: "new-address" }, { aliases: ["/old.html"] }]) {
    assert.match(validateSaveRevision(opened, { ...published, ...changed }), /different writing/);
  }
});

test("two edits across background publishing preserve both edits and use fresh conditional writes", async (t) => {
  const { withEditBase, validateSaveRevision } = await import("../app/save-state.ts");
  configureKdrive();
  const opened = withEditBase(piece("Repeat", { status: "published", kdrivePath: "Published/repeat.md", kdriveEtag: "v1" }));
  const sent = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    if (init.method === "MKCOL") return new Response(null, { status: 405 });
    sent.push(init);
    return new Response(null, { headers: { ETag: `v${sent.length + 1}` } });
  });
  const first = normalizeIncomingDocument({ ...opened, body: "First edit" }, opened);
  await saveKdrivePost(first, opened);
  const editor = withEditBase(first);
  const afterPublishing = { ...first, publicUpdatedAt: "2026-09-17T17:25:55Z", kdriveEtag: "publisher-v3" };
  const nextInput = { ...editor, body: "First edit plus second edit" };
  assert.equal(validateSaveRevision(nextInput, afterPublishing), null);
  const second = normalizeIncomingDocument(nextInput, afterPublishing);
  await saveKdrivePost(second, afterPublishing);
  assert.equal(sent[1].headers["If-Match"], "publisher-v3");
  assert.equal(parseWritingDocument(sent[1].body, second.path).body, nextInput.body);
  assert.equal(second.publicUpdatedAt, afterPublishing.publicUpdatedAt);
});

test("unsaved edits survive a reload with their original conflict baseline", async () => {
  const { withEditBase } = await import("../app/save-state.ts");
  const { rememberEdits, recoverEdits, forgetEdits, lastRecoveredDocument } = await import("../app/editor-recovery.ts");
  const values = new Map();
  const storage = { setItem: (k, v) => values.set(k, v), getItem: k => values.get(k) ?? null, removeItem: k => values.delete(k) };
  const saved = withEditBase(piece("Recovered"));
  const unsaved = { ...saved, body: "Writing that failed to save" };
  rememberEdits(storage, unsaved);
  assert.equal(lastRecoveredDocument(storage).id, unsaved.id);
  const recovered = recoverEdits(storage, { ...saved, body: "A concurrent remote edit" });
  assert.equal(recovered.body, unsaved.body);
  assert.equal(recovered.editBase, saved.editBase);
  forgetEdits(storage, saved.id);
  assert.equal(recoverEdits(storage, saved), null);
  assert.equal(lastRecoveredDocument(storage), null);
  const newDraft = { ...piece(""), id: "new:123", title: "", body: "An untitled, unsaved piece" };
  rememberEdits(storage, newDraft);
  assert.equal(lastRecoveredDocument(storage).body, newDraft.body);
});

test("typing during publishing survives the response with the new save baseline", async () => {
  const { withEditBase, acknowledgeSave, validateSaveRevision } = await import("../app/save-state.ts");
  const publishing = withEditBase(piece("Publishing", { status: "published", kdriveEtag: "before" }));
  const typed = { ...publishing, body: "More writing typed while Update was running" };
  const published = withEditBase({ ...publishing, publishedAt: "2026-09-17T18:00:00Z", publicUpdatedAt: "2026-09-17T18:00:00Z", kdriveEtag: "after" });
  const acknowledged = acknowledgeSave(typed, publishing, published);
  assert.equal(acknowledged.body, typed.body);
  assert.equal(acknowledged.publicUpdatedAt, published.publicUpdatedAt);
  assert.equal(acknowledged.publishedAt, published.publishedAt);
  assert.equal(validateSaveRevision(acknowledged, published), null);
});
