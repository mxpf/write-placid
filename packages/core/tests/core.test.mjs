import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCaptionMarkdown, parseImageMarkdown } from "../site/markdown.mjs";
import { createContentRepository, resolveDocumentLinks } from "../site/content.mjs";
import { generateRssFeed, generateSitemap, redirectDocument } from "../site/site.mjs";

const post = { type: "post", id: "550e8400-e29b-41d4-a716-446655440000", publicPath: "hello.md", sourcePath: "content/posts/hello.md", title: "Hello", slug: "hello", aliases: ["/old-hello.html"], date: "2026-01-01", publishedAt: "2026-01-01T00:00:00.000Z", status: "published", body: "A *small* note.", paragraphs: ["A *small* note."] };

test("caption links and image titles use the shared safe contract", () => {
  assert.deepEqual(parseCaptionMarkdown("A *quiet* [link](https://example.com)"), [{ text: "A " }, { text: "quiet", italic: true }, { text: " " }, { text: "link", href: "https://example.com" }]);
  assert.equal(parseCaptionMarkdown("[bad](javascript:alert(1))").map((run) => run.text).join(""), "[bad](javascript:alert(1))");
  assert.deepEqual(parseImageMarkdown('![Description](/images/example.jpg "A \\"quoted\\" caption")'), { alt: "Description", src: "/images/example.jpg", title: 'A "quoted" caption' });
});

test("repository factory validates immutable identities and resolves document links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "write-placid-core-"));
  await Promise.all(["posts", "pages", "now"].map((name) => mkdir(path.join(root, "content", name), { recursive: true })));
  const source = `---\ntitle: "Hello"\nid: ${post.id}\npublicPath: hello.md\nslug: hello\ndate: 2026-01-01\nstatus: published\naliases: ["/old-hello.html"]\npublishedAt: 2026-01-01T00:00:00.000Z\n---\n\nHello.\n`;
  const manifest = { version: 1, documents: [{ id: post.id, type: "post", slug: "hello", path: "content/posts/hello.md", url: "/hello.html", aliases: ["/old-hello.html"] }], redirects: { "/old-hello.html": "/hello.html" } };
  await writeFile(path.join(root, "content", "posts", "hello.md"), source);
  await writeFile(path.join(root, "content", "identity-manifest.json"), `${JSON.stringify(manifest)}\n`);
  const repository = createContentRepository({ projectRoot: root });
  assert.equal((await repository.readPosts())[0].id, post.id);
  assert.equal(resolveDocumentLinks(`[Hello](doc:${post.id}#part)`, [post]), "[Hello](/hello#part)");
});

test("feed, sitemap, and redirects are configuration-only and deterministic", () => {
  const feed = generateRssFeed([post], [], { siteName: "Example", siteUrl: "https://example.com", description: "Writing" });
  assert.match(feed, /<title>Example<\/title>/);
  assert.match(feed, /<em>small<\/em>/);
  assert.doesNotMatch(feed, /Thinkinghaus|mxpf/i);
  assert.match(generateSitemap([post], [], { siteUrl: "https://example.com" }), /https:\/\/example\.com\/hello/);
  const redirect = redirectDocument("/hello.html", { siteName: "Example" });
  assert.match(redirect, /location\.replace\("\/hello\.html" \+ location\.search \+ location\.hash\)/);
  assert.match(redirect, /Moved · Example/);
});
