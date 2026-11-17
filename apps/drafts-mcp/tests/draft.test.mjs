import assert from "node:assert/strict";
import test from "node:test";
import { prepareDraft } from "../src/draft.ts";
import { normalizeIncomingDocument } from "../../../packages/core/studio/content.ts";
import { planSave, withEditBase } from "../../../packages/core/studio/save-state.ts";

const draft = (changes = {}) => withEditBase({
  ...normalizeIncomingDocument({ title: "Private note", body: "Original writing.", date: "2026-11-01" }),
  ...changes,
});

test("a new draft stays private and receives an identity from Studio", () => {
  const input = prepareDraft({ title: "New note", body: "New writing." }, []);
  assert.equal(input.status, "draft");
  assert.equal(input.publishedAt, "");
  assert.equal(input.id, undefined);
  const result = planSave(input);
  assert.equal(result.error, null);
  assert.match(result.document.id, /^[a-f0-9-]{36}$/);
  assert.equal(result.document.body, "New writing.");
});

test("revising by slug or title updates the same private draft through Studio's save checks", () => {
  const existing = draft({ source: { label: "Reference", href: "https://example.com/reference" } });
  for (const selector of [{ slug: existing.slug }, { current_title: "PRIVATE NOTE" }, {}]) {
    const input = prepareDraft({ title: selector.current_title ? "Renamed note" : existing.title, body: "Revised writing.", ...selector }, [existing]);
    const result = planSave(input, existing);
    assert.equal(input.id, existing.id);
    assert.equal(input.editBase, existing.editBase);
    assert.equal(result.error, null);
    assert.equal(result.document.id, existing.id);
    assert.equal(result.document.path, existing.path);
    assert.equal(result.document.slug, existing.slug);
    assert.equal(result.document.date, existing.date);
    assert.deepEqual(result.document.source, existing.source);
    assert.equal(result.document.body, "Revised writing.");
    assert.equal(result.document.status, "draft");
  }
});

test("Studio rejects a concurrent body edit or deletion instead of recreating a draft", () => {
  const existing = draft();
  const input = prepareDraft({ title: existing.title, slug: existing.slug, body: "MCP revision." }, [existing]);
  const changed = { ...existing, body: "Competing editor revision." };
  assert.ok(planSave(input, changed).error);
  assert.equal(changed.body, "Competing editor revision.");
  assert.match(planSave(input).error, /no longer exists/);
});

test("a slug selects its exact draft even when another piece has the requested new title", () => {
  const existing = draft();
  const other = draft({ title: "Another note", slug: "another-note" });
  const input = prepareDraft({ title: other.title, slug: existing.slug, body: "Renamed writing." }, [other, existing]);
  assert.equal(input.id, existing.id);
  assert.equal(input.slug, existing.slug);
  assert.equal(planSave(input, existing).error, null);
});

test("missing, ambiguous, or conflicting revision selectors never become a new draft", () => {
  const existing = draft();
  const duplicate = draft({ slug: "another-note" });
  const base = { title: "New name", body: "Revision." };
  for (const selector of [
    { slug: "missing-note" },
    { current_title: "Missing note" },
    { slug: "missing-note", current_title: existing.title },
    { slug: existing.slug, current_title: "Another name" },
    { slug: "PRIVATE-NOTE" },
  ]) {
    assert.throws(() => prepareDraft({ ...base, ...selector }, [existing]), /could not be found|different pieces/);
  }
  assert.throws(() => prepareDraft({ ...base, current_title: existing.title }, [existing, duplicate]), /More than one/);
  assert.throws(() => prepareDraft({ ...base, title: existing.title }, [existing, duplicate]), /More than one/);
  assert.equal(prepareDraft({ ...base, slug: duplicate.slug, current_title: duplicate.title }, [existing, duplicate]).id, duplicate.id);
});

test("published work and every publication history marker are protected", () => {
  for (const marker of [
    { status: "published" },
    { publishedAt: "2026-11-01T00:00:00Z" },
    { publishedSource: "A public snapshot." },
    { publishedRevision: "public-revision" },
    { remoteSha: "public-commit" },
    { aliases: ["/old-note.html"] },
  ]) {
    const existing = draft(marker);
    assert.throws(() => prepareDraft({ title: existing.title, body: "Revision." }, [existing]), /publication history/);
    assert.throws(() => prepareDraft({ title: "New name", slug: existing.slug, body: "Revision." }, [existing]), /publication history/);
  }
  for (const type of ["page", "now"]) {
    const existing = draft({ type });
    assert.throws(() => prepareDraft({ title: existing.title, slug: existing.slug, body: "Revision." }, [existing]), /could not be found/);
  }
});

test("an existing draft requires Studio's identity and saved version", () => {
  for (const missing of [{ id: undefined }, { id: "" }, { editBase: undefined }, { editBase: "" }]) {
    const existing = { ...draft(), ...missing };
    assert.throws(() => prepareDraft({ title: existing.title, body: "Revision." }, [existing]), /identity and saved version/);
  }
});

test("source details are preserved or replaced as a complete pair", () => {
  const existing = draft({ source: { label: "Original", href: "https://example.com/original" } });
  const base = { title: existing.title, body: "Revision." };
  assert.deepEqual(prepareDraft(base, [existing]).source, existing.source);
  assert.deepEqual(prepareDraft({ ...base, source_label: "New", source_url: "https://example.com/new" }, [existing]).source, { label: "New", href: "https://example.com/new" });
  for (const source of [{ source_label: "Incomplete" }, { source_url: "https://example.com" }]) {
    assert.throws(() => prepareDraft({ ...base, ...source }, [existing]), /both a label and a URL/);
  }
});
