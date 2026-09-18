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
  readEditorImage,
  updateEditorImage,
} from "../app/rich-text.ts";
import { syncDocumentWithRemote } from "../app/drive.ts";
import { moveItemToTarget } from "../app/reorder.ts";
import {
  articleImageMarkdown,
  parseArticleImage,
  referencedLocalImages,
} from "../app/article-images.ts";
import { imageContentType, validateImageUpload, validImageName } from "../app/image-files.ts";

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
  assert.equal(parseWritingDocument(serializeWritingDocument(document), document.path).body, document.body);
  assert.match(serializeWritingDocument(document), /^id: "content\/posts\/a-quiet-test.md"$/m);
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
    readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/core/studio/studio.css", import.meta.url), "utf8"),
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
  assert.equal(renamed.id, post.id);
  assert.equal(renamed.slug, "strange-enough");
  assert.equal(renamed.path, "content/posts/strange-enough.md");
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
    /Only the About, Links, and AI pages/,
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

test("preserves public-compatible article images through Studio rich text", async () => {
  const localMarkdown = '![A quiet room](/images/a-quiet-room.jpg "Morning light")';
  assert.deepEqual(parseArticleImage(localMarkdown), {
    alt: "A quiet room",
    src: "/images/a-quiet-room.jpg",
    title: "Morning light",
  });
  assert.equal(articleImageMarkdown(parseArticleImage(localMarkdown)), localMarkdown);
  assert.equal(parseArticleImage("![Unsafe](javascript:alert(1))"), null);
  assert.equal(parseArticleImage("![Unsafe](//example.com/image.jpg)"), null);
  assert.deepEqual(
    referencedLocalImages(`${localMarkdown}\n\n![Remote](https://example.com/image.jpg)\n\n${localMarkdown}`),
    ["a-quiet-room.jpg", "a-quiet-room.jpg"],
  );

  const expected = '<div class="editor-image-block" contenteditable="false"><figure class="article-image" data-image-src="/images/a-quiet-room.jpg" data-image-title="Morning light" contenteditable="false" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Edit image: A quiet room"><img src="/api/content/image?name=a-quiet-room.jpg" alt="A quiet room" title="Morning light"><figcaption>Morning light</figcaption></figure><button type="button" class="edit-image-control" data-editor-image-control="true" aria-haspopup="dialog">Edit image &amp; caption</button></div>';
  assert.equal(markdownToEditorHtml(localMarkdown), expected);
  assert.equal(markdownPasteToEditorHtml(localMarkdown), expected);
  assert.match(
    markdownToEditorHtml("![Remote](https://example.com/image.jpg)"),
    /src="https:\/\/example\.com\/image\.jpg"/,
  );

  const image = {
    getAttribute: (name) => ({ src: "/api/content/image?name=a-quiet-room.jpg", alt: "A quiet room", title: "Morning light" })[name] || null,
  };
  const figure = {
    nodeType: 1,
    tagName: "FIGURE",
    childNodes: [],
    dataset: { imageSrc: "/images/a-quiet-room.jpg", imageTitle: "Morning light" },
    querySelector: (selector) => selector === "img" ? image : null,
  };
  const originalNode = globalThis.Node;
  globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
  try {
    assert.equal(editorToMarkdown({ childNodes: [figure] }), localMarkdown);
    const control = { nodeType: 1, tagName: "BUTTON", dataset: { editorImageControl: "true" }, childNodes: [{ nodeType: 3, nodeValue: "Edit image & caption" }] };
    const wrapper = { nodeType: 1, tagName: "DIV", childNodes: [figure, control] };
    assert.equal(editorToMarkdown({ childNodes: [wrapper] }), localMarkdown);
    assert.equal(editorToMarkdown({ childNodes: [control] }), "");
  } finally {
    if (originalNode) globalThis.Node = originalNode;
    else delete globalThis.Node;
  }

  const [studio, route, publisher, styles] = await Promise.all([
    readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/content/image/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/core/studio/publish-images.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/core/studio/studio.css", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /accept="image\/jpeg,image\/png,image\/webp,image\/gif"/);
  assert.match(route, /saveKdriveImage/);
  assert.match(publisher, /publishImageAsset/);
  assert.match(styles, /\.body-input \.article-image\s*\{[^}]*width: 112\.5%[^}]*margin: 60px -6\.25%/s);
  assert.match(styles, /\.body-input \.article-image img\s*\{[^}]*border-radius: 4px/s);
  assert.match(styles, /@media \(max-width: 767px\)\s*\{[^}]*\.body-input \.article-image\s*\{[^}]*width: 100%[^}]*margin: 48px 0/s);
});

test("editing image descriptions and adding, changing, or removing captions preserves the source and surrounding draft", () => {
  const attributes = new Map([["src", "/api/content/image?name=existing.jpg"], ["alt", "Original description"], ["title", "Existing caption"]]);
  const image = {
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
  };
  let caption = null;
  const figure = {
    nodeType: 1, tagName: "FIGURE", childNodes: [],
    dataset: { imageSrc: "/images/existing.jpg", imageTitle: "Existing caption" },
    querySelector: selector => selector === "img" ? image : caption,
    setAttribute: () => {},
    appendChild: node => { caption = node; },
    ownerDocument: { createElement: () => ({ textContent: "", remove: () => { caption = null; } }) },
  };
  const paragraph = text => ({ nodeType: 1, tagName: "P", childNodes: [{ nodeType: 3, nodeValue: text }] });
  const editor = { childNodes: [paragraph("Unsaved text before."), figure, paragraph("Unsaved text after.")] };
  const originalNode = globalThis.Node;
  globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
  try {
    assert.equal(readEditorImage(figure).title, "Existing caption");
    for (const details of [
      { alt: "A new description", title: "Existing caption" },
      { alt: "A new description", title: "A revised caption & credit" },
      { alt: "A new description", title: undefined },
      { alt: "A final description", title: "Caption restored" },
    ]) {
      assert.equal(updateEditorImage(figure, details), true);
      const markdown = articleImageMarkdown({ src: "/images/existing.jpg", ...details });
      assert.equal(editorToMarkdown(editor), `Unsaved text before.\n\n${markdown}\n\nUnsaved text after.`);
      assert.equal(image.getAttribute("src"), "/api/content/image?name=existing.jpg");
      assert.equal(figure.dataset.imageSrc, "/images/existing.jpg");
      assert.equal(caption?.innerHTML, details.title?.replace(/&/g, "&amp;"));
      assert.deepEqual(parseArticleImage(markdown), readEditorImage(figure));
      const rendered = markdownToEditorHtml(markdown);
      assert.equal(rendered.includes("<figcaption>"), Boolean(details.title));
      assert.match(rendered, /aria-haspopup="dialog"/);
    }
  } finally {
    if (originalNode) globalThis.Node = originalNode;
    else delete globalThis.Node;
  }
});

test("captions render as escaped visible text without becoming duplicate body text", () => {
  const markdown = '![Description](/images/existing.jpg "Credit <script>alert(1)</script> & company")';
  const html = markdownToEditorHtml(markdown);
  assert.match(html, /<figcaption>Credit &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; company<\/figcaption>/);
  assert.doesNotMatch(html, /<script>/);
  const external = '![Remote image](https://example.com/photo.jpg "External caption")';
  assert.equal(articleImageMarkdown(parseArticleImage(external)), external);
  assert.match(markdownToEditorHtml(external), /<figcaption>External caption<\/figcaption>/);
});

test("validates article image bytes instead of trusting file names", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = validateImageUpload(png, "A Quiet Room");
  assert.match(result.name, /^a-quiet-room-[a-f0-9]{8}\.png$/);
  assert.equal(result.contentType, "image/png");
  assert.equal(imageContentType("photo.WEBP"), "image/webp");
  assert.equal(validImageName("article-photo.jpeg"), true);
  assert.equal(validImageName("../article-photo.jpeg"), false);
  assert.throws(() => validateImageUpload(new TextEncoder().encode("<svg></svg>"), "Unsafe"), /JPEG, PNG, WebP, or GIF/);
});

test("keeps section headings on the 12px vertical grid", async () => {
  const styles = await readFile(new URL("../../../packages/core/studio/studio.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /\.body-input h2\s*\{[^}]*margin: 48px 0 24px[^}]*font-size: 12px[^}]*line-height: 24px/s,
  );
});

test("keeps block quotes on the 12px vertical grid", async () => {
  const [styles, studio, richText] = await Promise.all([
    readFile(new URL("../../../packages/core/studio/studio.css", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/core/studio/rich-text.ts", import.meta.url), "utf8"),
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

  const richText = await readFile(new URL("../../../packages/core/studio/rich-text.ts", import.meta.url), "utf8");
  const studio = await readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../../../packages/core/studio/studio.css", import.meta.url), "utf8");
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
  const studio = await readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /Edit link/);
  assert.match(studio, /Update link/);
  assert.match(studio, /Remove link/);
  assert.match(studio, /openExistingLink/);
});

test("opens the article requested by a public edit link", async () => {
  const studio = await readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(studio, /document\.slug === requestedSlug/);
  assert.match(studio, /document\.title === requestedTitle/);
  assert.match(studio, /setMobileScreen\("editor"\)/);
  assert.match(studio, /url\.searchParams\.delete\("slug"\)/);
});

test("offers recoverable deletion for saved posts", async () => {
  const [studio, route] = await Promise.all([
    readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/content/delete/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /private recovery copy/);
  assert.match(route, /Pages cannot be deleted here/);
  assert.match(route, /Move previously published work to Drafts/);
});

test("keeps publishing status responsive while live verification runs", async () => {
  const studio = await readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8");
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
    readFile(new URL("../../../packages/core/studio/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/content/reorder/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/core/studio/d1.ts", import.meta.url), "utf8"),
  ]);
  assert.match(studio, /\(min-width: 701px\) and \(pointer: fine\)/);
  assert.match(studio, /draggable=\{reorderable\}/);
  assert.match(route, /reorderDraftDocuments/);
  assert.match(storage, /unique\.size !== ids\.length/);
  assert.match(storage, /ORDER BY type ASC,sort_order ASC,date DESC/);
  assert.match(storage, /ON CONFLICT\(id\) DO UPDATE/);
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
