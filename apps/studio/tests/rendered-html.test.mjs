import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  calculateReadingTime,
  isDocumentDirty,
  markRevisedPost,
  normalizeIncomingDocument,
  parseWritingDocument,
  serializeWritingDocument,
} from "../app/content.ts";
import { smartenQuotes, smartQuoteForInput } from "../app/smart-quotes.ts";
import {
  editorToMarkdown,
  markdownPasteToEditorHtml,
  markdownToEditorHtml,
  numberedListShortcutStart,
} from "../app/rich-text.ts";
import { syncDocumentWithRemote } from "../app/drive.ts";
import { moveItemToTarget } from "../app/reorder.ts";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the private Write Placid Studio shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>Write Placid Studio<\/title>/i);
  assert.match(html, /Write Placid/);
  assert.match(html, /Studio/);
  assert.match(html, /New piece/);
  assert.match(html, /New now/);
  assert.match(html, /Publish/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("uses the configured publication identity", async () => {
  const studio = await readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /studioConfig\.publicationName/);
  assert.match(studio, /href=\{studioConfig\.siteUrl\}/);
  assert.doesNotMatch(studio, /thinking\.haus/);
});

test("preserves Write Placid Markdown and computes reading time", () => {
  const source = `---
title: "A quiet test"
slug: a-quiet-test
date: 2026-08-07
status: draft
sourceLabel: "Read more"
sourceHref: "https://example.com"
---

One *small* paragraph with a [link](https://example.com).
`;
  const document = parseWritingDocument(
    source,
    "content/posts/a-quiet-test.md",
    "abc123",
  );
  assert.equal(document.status, "draft");
  assert.equal(document.source?.href, "https://example.com");
  assert.equal(document.remoteSha, "abc123");
  assert.equal(serializeWritingDocument(document).trim(), source.trim());
  assert.equal(isDocumentDirty(document), false);
  assert.equal(calculateReadingTime("word ".repeat(181)), "2 minutes");
});

test("adds public edit metadata only when revising an existing published post", () => {
  const draft = normalizeIncomingDocument({
    type: "post",
    title: "A new thought",
    body: "First version.",
  });
  const firstPublication = markRevisedPost({ ...draft, status: "published" }, "2026-08-19T17:00:00.000Z");
  assert.equal(firstPublication.publicUpdatedAt, "");
  assert.doesNotMatch(serializeWritingDocument(firstPublication), /^updatedAt:/m);

  const published = parseWritingDocument(
    serializeWritingDocument(firstPublication),
    firstPublication.path,
  );
  const revision = markRevisedPost(
    { ...published, body: "Materially revised version." },
    "2026-08-20T17:00:00.000Z",
  );
  assert.equal(revision.publicUpdatedAt, "2026-08-20T17:00:00.000Z");
  assert.match(
    serializeWritingDocument(revision),
    /^updatedAt: 2026-08-20T17:00:00\.000Z$/m,
  );
});

test("shows post and modified dates separately in Studio", async () => {
  const [studio, styles] = await Promise.all([
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /current\.type === "post" \? "Post date"/);
  assert.match(studio, /Last edited \{displayDate\(current\.publicUpdatedAt\.slice\(0, 10\)\)\}/);
  assert.match(styles, /\.modified-date\s*\{[^}]*color: var\(--muted\)[^}]*font-size: 12px[^}]*font-style: italic/s);
});

test("creates safe post paths and limits editable pages", () => {
  const post = normalizeIncomingDocument({
    type: "post",
    title: "Strange Enough",
    body: "A beginning.",
  });
  assert.equal(post.slug, "strange-enough");
  assert.equal(post.path, "content/posts/strange-enough.md");
  assert.equal(post.status, "draft");

  const renamed = normalizeIncomingDocument(
    { ...post, title: "Stranger Still" },
    { ...post, remoteSha: "abc123" },
  );
  assert.equal(renamed.id, "content/posts/strange-enough.md");
  assert.equal(renamed.slug, "stranger-still");
  assert.equal(renamed.path, "content/posts/stranger-still.md");
  assert.equal(renamed.remoteSha, "abc123");

  const now = normalizeIncomingDocument({
    type: "now",
    title: "Now",
    slug: "now-20260813150000",
    date: "2026-08-13",
    body: "What is holding my attention.",
  });
  assert.equal(now.type, "now");
  assert.equal(now.path, "content/now/now-20260813150000.md");
  assert.equal(now.status, "draft");
  assert.equal(
    parseWritingDocument(serializeWritingDocument(now), now.path).type,
    "now",
  );

  assert.throws(
    () =>
      normalizeIncomingDocument({
        type: "page",
        title: "Secret settings",
        slug: "secret-settings",
      }),
    /Only the About and Links pages/,
  );
});

test("uses smart quotes without changing Markdown destinations", () => {
  assert.equal(
    smartenQuotes(`He said "This isn't ordinary."`),
    "He said “This isn’t ordinary.”",
  );
  assert.equal(
    smartenQuotes(`[O'Reilly](https://example.com/o'reilly)`),
    `[O’Reilly](https://example.com/o'reilly)`,
  );
  assert.equal(smartQuoteForInput('"', ""), "“");
  assert.equal(smartQuoteForInput('"', "word"), "”");
  assert.equal(smartQuoteForInput("'", ""), "‘");
  assert.equal(smartQuoteForInput("'", "n"), "’");
});

test("renders the supported Markdown as safe editor HTML", () => {
  assert.equal(
    markdownToEditorHtml("One *small* paragraph with a [link](https://example.com)."),
    '<p>One <em>small</em> paragraph with a <a href="https://example.com" target="_blank" rel="noreferrer">link</a>.</p>',
  );
  assert.equal(
    markdownToEditorHtml("Before.\n\n## A dividing thought\n\nAfter."),
    "<p>Before.</p><h2>A dividing thought</h2><p>After.</p>",
  );
  assert.equal(
    markdownToEditorHtml("Before.\n\n> A useful interruption.\n\nAfter."),
    "<p>Before.</p><blockquote>A useful interruption.</blockquote><p>After.</p>",
  );
  assert.equal(
    markdownToEditorHtml('<script>alert("no")</script>'),
    "<p>&lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;</p>",
  );
});

test("recognizes supported Markdown when it is pasted into the editor", () => {
  assert.equal(markdownPasteToEditorHtml("Ordinary prose with a hyphen - inside it."), null);
  assert.equal(
    markdownPasteToEditorHtml("A *formatted* thought with a [source](https://example.com)."),
    '<p>A <em>formatted</em> thought with a <a href="https://example.com" target="_blank" rel="noreferrer">source</a>.</p>',
  );
  assert.equal(
    markdownPasteToEditorHtml("## A section\n\n> A useful interruption."),
    "<h2>A section</h2><blockquote>A useful interruption.</blockquote>",
  );
});

test("keeps section headings on the 12px vertical grid", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /\.body-input h2\s*\{[^}]*margin: 48px 0 24px[^}]*font-size: 12px[^}]*line-height: 24px/s,
  );
});

test("keeps block quotes on the 12px vertical grid", async () => {
  const [styles, studio, richText] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/rich-text.ts", import.meta.url), "utf8"),
  ]);
  assert.match(
    styles,
    /\.body-input blockquote\s*\{[^}]*position: relative[^}]*padding: 0 0 0 24px[^}]*margin: 36px 0[^}]*font: inherit/s,
  );
  assert.match(
    styles,
    /\.body-input blockquote::before\s*\{[^}]*inset-block: 0[^}]*inset-inline-start: 0[^}]*width: 1px[^}]*background: var\(--muted\)/s,
  );
  assert.match(studio, /aria-label="Block quote"/);
  assert.match(richText, /case "blockquote"/);
});

test("renders quoted legacy references as rich links", () => {
  assert.equal(
    markdownToEditorHtml('Its “Task Avoidance” (https://example.com/task-avoidance) helped.'),
    '<p>Its <a href="https://example.com/task-avoidance" target="_blank" rel="noreferrer">“Task Avoidance”</a> helped.</p>',
  );
});

test("renders Markdown lists as hanging bullet lists in the editor", () => {
  assert.equal(
    markdownToEditorHtml("A short list:\n\n- First item\n\n- A [linked item](https://example.com)"),
    '<p>A short list:</p><ul><li>First item</li><li>A <a href="https://example.com" target="_blank" rel="noreferrer">linked item</a></li></ul>',
  );
  assert.equal(
    markdownPasteToEditorHtml("* First item\n* Second item"),
    "<ul><li>First item</li><li>Second item</li></ul>",
  );
});

test("preserves numbered Markdown lists through Studio rich text", async () => {
  assert.equal(numberedListShortcutStart("1."), 1);
  assert.equal(numberedListShortcutStart("12."), 12);
  assert.equal(numberedListShortcutStart("A number: 1."), null);
  assert.equal(numberedListShortcutStart("1. Item"), null);
  assert.equal(
    markdownPasteToEditorHtml("1. First item\n2. Second item\n   continues on another line."),
    "<ol><li>First item</li><li>Second item continues on another line.</li></ol>",
  );
  assert.equal(
    markdownToEditorHtml("3. First item.\n\n4. A *second* item."),
    '<ol start="3"><li>First item.</li><li>A <em>second</em> item.</li></ol>',
  );

  const orderedList = {
    nodeType: 1,
    tagName: "OL",
    childNodes: [],
    children: [],
    parentElement: null,
    getAttribute: (name) => name === "start" ? "3" : null,
  };
  const listItems = ["First item.", "Second item."].map((value) => ({
    nodeType: 1,
    tagName: "LI",
    childNodes: [{ nodeType: 3, nodeValue: value }],
    children: [],
    parentElement: orderedList,
    getAttribute: () => null,
  }));
  orderedList.childNodes = listItems;
  orderedList.children = listItems;
  const originalNode = globalThis.Node;
  globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
  try {
    assert.equal(
      editorToMarkdown({ childNodes: [orderedList] }),
      "3. First item.\n\n4. Second item.",
    );
  } finally {
    if (originalNode) globalThis.Node = originalNode;
    else delete globalThis.Node;
  }

  const richText = await readFile(new URL("../app/rich-text.ts", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(richText, /parent\?\.tagName\.toLowerCase\(\) === "ol"/);
  assert.match(richText, /case "ol"/);
  assert.match(studio, /document\.execCommand\("insertOrderedList", false\)/);
  assert.match(
    styles,
    /\.body-input ol\s*\{[^}]*padding-inline-start: 2em[^}]*list-style: decimal/s,
  );
  assert.match(
    styles,
    /\.body-input ol li::marker\s*\{[^}]*color: var\(--muted\)[^}]*font-size: 12px[^}]*font-variant-numeric: tabular-nums/s,
  );
});

test("offers editing and removal for links already in the editor", async () => {
  const studio = await readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /Edit link/);
  assert.match(studio, /Update link/);
  assert.match(studio, /Remove link/);
  assert.match(studio, /openExistingLink/);
});

test("opens the article requested by a public edit link", async () => {
  const studio = await readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(studio, /document\.slug === requestedSlug/);
  assert.match(studio, /document\.title === requestedTitle/);
  assert.match(studio, /setMobileScreen\("editor"\)/);
  assert.match(studio, /url\.searchParams\.delete\("slug"\)/);
});

test("offers recoverable deletion for saved posts", async () => {
  const [studio, route] = await Promise.all([
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/content/delete/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /private recovery copy/);
  assert.match(route, /Pages cannot be deleted here/);
  assert.match(route, /deleteGithubDocument/);
});

test("keeps publishing status responsive while live verification runs", async () => {
  const studio = await readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(studio, /setSaveState\("Updating live…"\)/);
  assert.match(studio, /const controller = new AbortController\(\)/);
  assert.match(studio, /signal: controller\.signal/);
  assert.match(studio, /controller\.abort\(\)/);
  assert.match(studio, /window\.clearTimeout\(timeout\)/);
});

test("reorders drafts without disturbing the rest of the library", async () => {
  const drafts = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(moveItemToTarget(drafts, "a", "c").map((item) => item.id), ["b", "c", "a"]);
  assert.deepEqual(moveItemToTarget(drafts, "c", "a").map((item) => item.id), ["c", "a", "b"]);
  assert.equal(moveItemToTarget(drafts, "missing", "a"), drafts);

  const [studio, route, storage] = await Promise.all([
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/content/reorder/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/documents.ts", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /\(min-width: 701px\) and \(pointer: fine\)/);
  assert.match(studio, /draggable=\{reorderable\}/);
  assert.match(route, /reorderDraftDocuments/);
  assert.match(storage, /uniqueIds\.size !== ids\.length/);
  assert.match(storage, /asc\(documents\.sortOrder\), desc\(documents\.date\)/);
  assert.match(storage, /set: rowUpdates\(row\)/);
});

test("uses KDrive as the canonical article repository", async () => {
  const [kdrive, sync, worker, config, loadRoute, saveRoute, publishRoute, deleteRoute, readme, envExample] =
    await Promise.all([
      readFile(new URL("../app/kdrive.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/kdrive-sync.ts", import.meta.url), "utf8"),
      readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
      readFile(new URL("../wrangler.cloudflare.jsonc", import.meta.url), "utf8"),
      readFile(new URL("../app/api/content/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/content/save/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/content/publish/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/content/delete/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
    ]);
  assert.match(kdrive, /folder: "Drafts" \| "Published"/);
  assert.doesNotMatch(kdrive, /Research/);
  assert.match(kdrive, /method: "PROPFIND"/);
  assert.match(kdrive, /method: "PUT"/);
  assert.match(sync, /listKdrivePostRefs/);
  assert.match(sync, /const batchSize = 5/);
  assert.match(sync, /getSyncCursor/);
  assert.match(sync, /setSyncCursor/);
  assert.match(sync, /document\.status === "published" && isDocumentDirty\(document\)/);
  assert.match(sync, /document\.status === "draft" && document\.remoteSha/);
  assert.match(sync, /deleteDocument\(cached\.id\)/);
  assert.match(worker, /scheduled\(/);
  assert.match(worker, /syncKdriveRepository\(\)/);
  assert.match(config, /"crons": \["\*\/5 \* \* \* \*"\]/);
  assert.match(loadRoute, /syncKdriveRepository/);
  assert.match(saveRoute, /saveKdrivePost\(document, existing\)/);
  assert.match(publishRoute, /saveKdrivePost\(published, document\)/);
  assert.match(deleteRoute, /deleteKdrivePost\(document\)/);
  assert.match(readme, /KDrive is an optional canonical repository/);
  assert.match(envExample, /WRITE_PLACID_KDRIVE_USERNAME=\n/);
  assert.match(envExample, /WRITE_PLACID_KDRIVE_APP_PASSWORD=\n/);
});

test("preserves monorepo publishing and private Drafts MCP authorization", async () => {
  const [github, auth, envExample] = await Promise.all([
    readFile(new URL("../app/github.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/server-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(github, /WRITE_PLACID_GITHUB_CONTENT_ROOT \|\| "apps\/site"/);
  assert.match(github, /repositoryPath\("content\/posts"\)/);
  assert.match(github, /documentPath\(entry\.path\)/);
  assert.match(auth, /WRITE_PLACID_INTERNAL_TOKEN/);
  assert.match(auth, /x-write-placid-token/);
  assert.match(auth, /crypto\.subtle\.verify/);
  assert.match(envExample, /WRITE_PLACID_GITHUB_CONTENT_ROOT=apps\/site/);
});

test("pulls Google Docs edits and detects two-sided conflicts", async () => {
  const source = `---
title: "A quiet test"
slug: a-quiet-test
date: 2026-08-07
status: draft
---

Original body.
`;
  const document = parseWritingDocument(source, "content/posts/a-quiet-test.md");
  document.googleDocId = "doc-1";
  document.driveRevision = "1";
  document.driveSyncedBody = "Original body.";

  const pulled = await syncDocumentWithRemote(document, {
    id: "doc-1",
    title: document.title,
    body: "Revised in Google Docs.",
    revision: "2",
  });
  assert.equal(pulled.state, "pulled");
  assert.equal(pulled.document.body, "Revised in Google Docs.");

  const conflict = await syncDocumentWithRemote(
    { ...document, body: "Revised in Studio." },
    {
      id: "doc-1",
      title: document.title,
      body: "A different Docs revision.",
      revision: "3",
    },
  );
  assert.equal(conflict.state, "conflict");
  assert.equal(conflict.remoteBody, "A different Docs revision.");
});

test("includes installable app assets, both type styles, and no starter dependencies", async () => {
  const [smallIcon, largeIcon, regularFont, italicFont, manifest, packageJson] = await Promise.all([
    stat(new URL("../public/icon-192.png", import.meta.url)),
    stat(new URL("../public/icon-512.png", import.meta.url)),
    stat(new URL("../public/fonts/InstrumentSans-Variable.ttf", import.meta.url)),
    stat(new URL("../public/fonts/InstrumentSans-Italic-Variable.ttf", import.meta.url)),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.ok(smallIcon.size > 1_000);
  assert.ok(largeIcon.size > smallIcon.size);
  assert.ok(regularFont.size > 20_000);
  assert.ok(italicFont.size > 20_000);
  assert.match(manifest, /display: "standalone"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
