import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  calculateReadingTime,
  isDocumentDirty,
  normalizeIncomingDocument,
  parseWritingDocument,
  serializeWritingDocument,
} from "../app/content.ts";
import { smartenQuotes } from "../app/smart-quotes.ts";
import { markdownToEditorHtml } from "../app/rich-text.ts";
import { syncDocumentWithRemote } from "../app/drive.ts";

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

test("preserves publication Markdown and computes reading time", () => {
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
  assert.equal(calculateReadingTime("word ".repeat(181)), "2 minute read");
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
