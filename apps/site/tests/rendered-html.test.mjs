import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { parseContentBlocks, parseInlineMarkdown, stripInlineMarkdown } from "../lib/markdown.mjs";
import { calculateReadingTime, parsePost, readNowEntries, readPages, readPosts, serializePost } from "../scripts/content.mjs";
import { generateRssFeed } from "../scripts/rss.mjs";

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

test("renders the Write Placid index from published Markdown", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  const posts = await readPosts();

  assert.match(html, /<title>Write Placid<\/title>/i);
  assert.match(html, /class="letter-cascade is-in" aria-label="Write Placid"/);
  for (const post of posts) assert.ok(html.includes(post.title));
  assert.match(html, /href="\/about"/);
  assert.match(html, /href="\/links"/);
  assert.match(html, /href="\/now"/);
  assert.match(html, /href="\/rss\.xml" type="application\/rss\+xml">RSS<\/a>/);
  assert.ok(html.indexOf(">Links</a>") < html.indexOf(">Now</a>"));
  assert.ok(html.indexOf(">Now</a>") < html.indexOf(">RSS</a>"));
  assert.match(
    html,
    /<link rel="alternate" type="application\/rss\+xml" href="https:\/\/example\.com\/rss\.xml"/,
  );
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /data-endpoint=/);
  assert.match(html, /<script[^>]+src="\/author-mode\.js"/);
  assert.doesNotMatch(html, /class="scroll-progress"/);
  assert.doesNotMatch(html, /Thinkinghaus Studio/);
});

test("static homepage links point directly to exported article files", async () => {
  const index = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  const posts = await readPosts();

  for (const post of posts) {
    assert.match(index, new RegExp(`href="/${post.slug}\\.html"`));
  }
});

test("mounts reading progress on published article pages only", async () => {
  const [post] = await readPosts();
  const response = await render(`/${post.slug}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="scroll-progress"/);
  assert.match(html, /aria-hidden="true"/);
});

test("can prefix internal links for a GitHub project Pages deployment", async () => {
  process.env.NEXT_PUBLIC_PAGES_BASE_PATH = "/write-placid";
  const moduleUrl = new URL("../app/site-path.ts", import.meta.url);
  moduleUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { sitePath } = await import(moduleUrl.href);
  delete process.env.NEXT_PUBLIC_PAGES_BASE_PATH;
  assert.equal(sitePath("/about"), "/write-placid/about");
  assert.equal(sitePath("https://example.com"), "https://example.com");
});

test("keeps edit controls private until author mode is activated", async () => {
  const source = await readFile(new URL("../public/author-mode.js", import.meta.url), "utf8");

  function runAuthorMode(hash, stored = null) {
    const values = new Map(stored ? [["write-placid-author-mode", stored]] : []);
    const link = { href: "" };
    const action = { hidden: true, querySelector: () => link };
    const article = {
      dataset: { contentSlug: "where-the-work-is", contentTitle: "Where the work is" },
      querySelector: () => action,
    };
    const window = {
      location: { hash, pathname: "/where-the-work-is.html", search: "" },
      history: { replaceState() {} },
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    };
    vm.runInNewContext(source, {
      URL,
      window,
      document: {
        body: { dataset: { studioUrl: "https://studio.example.com/" } },
        querySelector: () => article,
      },
    });
    return { action, link, values };
  }

  assert.equal(runAuthorMode("").action.hidden, true);

  const activated = runAuthorMode("#edit");
  assert.equal(activated.action.hidden, false);
  assert.equal(activated.values.get("write-placid-author-mode"), "on");
  assert.match(activated.link.href, /[?&]slug=where-the-work-is/);
  assert.match(activated.link.href, /[?&]title=Where(?:\+|%20)the(?:\+|%20)work(?:\+|%20)is/);

  assert.equal(runAuthorMode("", "on").action.hidden, false);
  assert.equal(runAuthorMode("#edit-off", "on").action.hidden, true);
});

test("generates an RSS feed from published posts", async () => {
  const posts = await readPosts();
  const nowEntries = await readNowEntries();
  const feed = generateRssFeed(posts, nowEntries);
  const generatedFeed = await readFile(new URL("../public/rss.xml", import.meta.url), "utf8");

  assert.equal(generatedFeed, feed);
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(feed, /<rss version="2\.0"/);
  assert.match(
    feed,
    /<atom:link href="https:\/\/example\.com\/rss\.xml" rel="self" type="application\/rss\+xml" \/>/,
  );
  assert.equal(feed.match(/<item>/g)?.length, posts.length + nowEntries.length);
  for (const post of posts) {
    assert.ok(feed.includes(`<link>https://example.com/${post.slug}</link>`));
  }
  assert.match(feed, /<content:encoded><!\[CDATA\[<p>/);
  assert.match(feed, /<em>/);

  const drafts = (await readPosts({ includeDrafts: true }))
    .filter((post) => post.status === "draft");
  for (const draft of drafts) {
    assert.doesNotMatch(feed, new RegExp(`<link>https://example\\.com/${draft.slug}</link>`));
  }

  const escaped = generateRssFeed([{
    title: "A & B",
    slug: "a-and-b",
    date: "2026-08-10",
    publishedAt: "2026-08-10T12:00:00.000Z",
    paragraphs: ["A *small* [link](https://example.com/?a=1&b=2)."],
  }]);
  assert.match(escaped, /<title>A &amp; B<\/title>/);
  assert.match(escaped, /<em>small<\/em>/);
  assert.match(escaped, /href="https:\/\/example\.com\/\?a=1&amp;b=2"/);

  const withNow = generateRssFeed([], [{
    type: "now",
    title: "Now",
    slug: "now-20260813150000",
    date: "2026-08-13",
    publishedAt: "2026-08-13T15:00:00.000Z",
    paragraphs: ["A small current note."],
  }]);
  assert.match(withNow, /<title>Now — August 13, 2026<\/title>/);
  assert.match(withNow, /<link>https:\/\/example\.com\/now<\/link>/);
  assert.match(withNow, /<guid isPermaLink="false">write-placid:now:now-20260813150000<\/guid>/);
});

test("publishes crawlable canonical routes", async () => {
  const [robots, sitemap, posts, pages] = await Promise.all([
    readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
    readPosts(),
    readPages(),
  ]);

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/example\.com\/sitemap\.xml$/m);
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<loc>https:\/\/example\.com\/about<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.com\/ai<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.com\/now<\/loc>/);
  for (const { slug } of [...pages, ...posts]) {
    assert.ok(sitemap.includes(`<loc>https://example.com/${slug}</loc>`));
  }
});

test("renders standalone About, AI, and Links pages", async () => {
  const pages = await readPages();
  assert.deepEqual(pages.map((page) => page.slug), ["about", "ai", "links"]);

  const aboutResponse = await render("/about");
  assert.equal(aboutResponse.status, 200);
  const aboutHtml = await aboutResponse.text();
  assert.match(aboutHtml, /<title>Write Placid - About<\/title>/i);
  assert.match(aboutHtml, /<link rel="canonical" href="https:\/\/example\.com\/about"/);
  assert.ok(aboutHtml.includes(pages.find((page) => page.slug === "about").paragraphs[0]));
  assert.doesNotMatch(aboutHtml, /class="scroll-progress"/);

  const aiResponse = await render("/ai");
  assert.equal(aiResponse.status, 200);
  const aiHtml = await aiResponse.text();
  assert.match(aiHtml, /<title>Write Placid - AI<\/title>/i);
  assert.match(aiHtml, /does not require AI/);
  assert.doesNotMatch(aiHtml, /<nav[^>]*>[\s\S]*?>AI<\/a>/);
  assert.doesNotMatch(aiHtml, /class="scroll-progress"/);

  const linksResponse = await render("/links");
  assert.equal(linksResponse.status, 200);
  const linksHtml = await linksResponse.text();
  assert.ok(linksHtml.includes(pages.find((page) => page.slug === "links").paragraphs[0]));
  assert.doesNotMatch(linksHtml, /class="scroll-progress"/);
});

test("renders only the newest published Now entry on its stable route", async () => {
  const response = await render("/now");
  assert.equal(response.status, 200);
  const html = await response.text();
  const entries = await readNowEntries();
  assert.match(html, /<title>Write Placid - Now<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/now"/);
  assert.doesNotMatch(html, /class="scroll-progress"/);
  if (entries[0]) {
    assert.ok(html.includes(entries[0].paragraphs[0]));
    assert.match(html, /<ul class="article-list"><li>Replacing this sample/);
    assert.equal((html.match(/<li>/g) ?? []).length, 2);
    assert.doesNotMatch(html, /<p>- Replacing/);
    assert.match(html, /href="https:\/\/sive\.rs\/nowff"[^>]*>Derek Sivers(?:&apos;|&#x27;|') \/now idea<\/a>/);
    assert.match(html, /a simple page for what (?:you(?:&apos;|&#x27;|')re|you’re) actually paying attention to right now\./);
    for (const archived of entries.slice(1)) {
      assert.ok(!html.includes(archived.paragraphs[0]));
    }
  } else {
    assert.match(html, /Nothing here yet\./);
  }
});

test("keeps published writing readable and the visual system intentional", async () => {
  const posts = await readPosts({ includeDrafts: true });
  assert.ok(posts.length > 0);
  assert.ok(posts.every((post) => post.body.length > 0));
  assert.ok(posts.every((post) => /^[a-z0-9-]+$/.test(post.slug)));

  const [siteStyles, articleBody, articlePage, authorEditAction, authorMode, scrollProgress] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/ArticleBody.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AuthorEditAction.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/author-mode.js", import.meta.url), "utf8"),
    readFile(new URL("../app/ScrollProgress.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(siteStyles, /--step-article-title/);
  assert.doesNotMatch(siteStyles, /--reading-measure/);
  assert.match(siteStyles, /\.site\s*\{[^}]*font-size: 16px/s);
  assert.match(siteStyles, /:root\s*\{[^}]*--blog-background: #1a1814;[^}]*--blog-foreground: #f1ede3;[^}]*--blog-muted: #9a9285;[^}]*--blog-body: #b3aca2;[^}]*color-scheme: dark;/s);
  assert.doesNotMatch(siteStyles, /prefers-color-scheme/);
  assert.match(siteStyles, /\.letter-cascade\s*\{[^}]*gap: 0;[^}]*letter-spacing: 0;/s);
  assert.match(siteStyles, /font-family: "Instrument Sans";[^}]*InstrumentSans-Variable\.ttf[^}]*font-weight: 100 900/s);
  assert.match(siteStyles, /font-family: "Instrument Sans";[^}]*InstrumentSans-Italic-Variable\.ttf[^}]*font-style: italic/s);
  assert.match(siteStyles, /\.site\s*\{[^}]*font-size: 16px[^}]*font-weight: 300[^}]*line-height: 24px/s);
  assert.match(siteStyles, /\.article-body em\s*\{[^}]*font-family: "Instrument Sans"[^}]*font-style: italic[^}]*font-weight: 400/s);
  assert.match(siteStyles, /\.site \.desktop-brand\s*\{[^}]*font-weight: 400/s);
  assert.match(siteStyles, /\.scroll-progress\s*\{[^}]*position: fixed[^}]*inset: 0 0 auto[^}]*height: 1px[^}]*background: var\(--blog-body\)[^}]*pointer-events: none[^}]*transform: scaleX\(var\(--scroll-progress\)\)[^}]*transform-origin: left/s);
  assert.match(siteStyles, /html\s*\{[^}]*scrollbar-width: none/s);
  assert.match(siteStyles, /html::-webkit-scrollbar\s*\{[^}]*display: none/s);
  assert.match(siteStyles, /\.index-frame\s*\{[^}]*font-weight: 400/s);
  assert.doesNotMatch(siteStyles, /font-size:\s*15px/);
  assert.doesNotMatch(siteStyles, /\.site \.index-frame \.desktop-brand/);
  assert.match(siteStyles, /\.site \.post-list a\s*\{[^}]*font-weight: 400/s);
  assert.match(siteStyles, /\.site \.footer\s*\{[^}]*font-weight: 400/s);
  assert.match(siteStyles, /\.site \.footer-brand\s*\{[^}]*font-weight: 400/s);
  assert.match(siteStyles, /\.site \.article-header h1\s*\{[^}]*font-size: 16px[^}]*font-weight: 400[^}]*line-height: 24px[^}]*text-wrap: balance/s);
  assert.match(siteStyles, /\.article-body p\s*\{[^}]*hanging-punctuation: first[^}]*text-wrap: pretty/s);
  assert.match(siteStyles, /\.article-body\s*\{[^}]*color: var\(--blog-body\)[^}]*font-weight: 400/s);
  assert.match(siteStyles, /\.site \.article-body h2\s*\{[^}]*margin: 48px 0 24px[^}]*color: var\(--blog-muted\)[^}]*font-size: 12px[^}]*font-weight: 400[^}]*letter-spacing: 0\.06em[^}]*line-height: 24px[^}]*text-transform: uppercase/s);
  assert.match(siteStyles, /\.article-body blockquote\s*\{[^}]*position: relative[^}]*padding: 0 0 0 24px[^}]*margin: 36px 0/s);
  assert.match(siteStyles, /\.article-body blockquote::before\s*\{[^}]*inset-block: 0[^}]*inset-inline-start: 0[^}]*width: 1px[^}]*background: var\(--blog-muted\)/s);
  assert.match(siteStyles, /\.article-body p\.optical-margin-fallback\s*\{[^}]*text-indent: -0\.42em/s);
  assert.match(siteStyles, /\.article-body \.article-source,\s*\.site \.article-last-edited\s*\{[^}]*margin-top: 48px/s);
  assert.match(articleBody, /<h2 key=/);
  assert.match(articleBody, /<blockquote key=/);
  assert.match(articleBody, /optical-margin-fallback/);
  assert.match(articlePage, /<AuthorEditAction \/>/);
  assert.match(articlePage, /post \? <ScrollProgress \/> : null/);
  assert.match(authorEditAction, /className="author-edit-action" hidden/);
  assert.match(scrollProgress, /window\.requestAnimationFrame\(updateProgress\)/);
  assert.match(scrollProgress, /window\.addEventListener\("scroll", scheduleUpdate, \{ passive: true \}\)/);
  assert.match(scrollProgress, /window\.addEventListener\("resize", scheduleUpdate\)/);
  assert.match(scrollProgress, /Math\.min\(1, Math\.max\(0, root\.scrollTop \/ scrollableHeight\)\)/);
  assert.match(scrollProgress, /setProperty\("--scroll-progress", String\(progress\)\)/);
  assert.match(authorMode, /write-placid-author-mode/);
  assert.match(authorMode, /location\.hash === "#edit"/);
  assert.match(authorMode, /location\.hash === "#edit-off"/);
  assert.match(authorMode, /dataset\.studioUrl/);
});

test("interprets article and RSS block structure from one shared parser", () => {
  assert.deepEqual(parseContentBlocks([
    "Before.",
    "## A small heading",
    "> A useful interruption.",
    "- First item.",
    "- Second item.",
    "3. Third item.",
    "4. Fourth item.",
  ]), [
    { type: "paragraph", index: 0, text: "Before." },
    { type: "heading", index: 1, text: "A small heading" },
    { type: "blockquote", index: 2, text: "A useful interruption." },
    { type: "unordered-list", index: 3, items: ["First item.", "Second item."] },
    { type: "ordered-list", index: 5, start: 3, items: ["Third item.", "Fourth item."] },
  ]);
});

test("supports safe inline italics and links", async () => {
  assert.deepEqual(parseInlineMarkdown("A *strange* [path](https://example.com)."), [
    { type: "text", value: "A " },
    { type: "italic", value: "strange" },
    { type: "text", value: " " },
    { type: "link", value: "path", href: "https://example.com" },
    { type: "text", value: "." },
  ]);
  assert.equal(stripInlineMarkdown("A *strange* [path](https://example.com)."), "A strange path.");
  assert.equal(stripInlineMarkdown("A *[strange path](https://example.com)*."), "A strange path.");
  assert.equal(stripInlineMarkdown("A [*strange path*](https://example.com)."), "A strange path.");
  assert.deepEqual(parseInlineMarkdown("[No](javascript:alert(1))"), [
    { type: "text", value: "[No](javascript:alert(1)" },
    { type: "text", value: ")" },
  ]);

  const italicFont = await stat(
    new URL("../public/fonts/InstrumentSans-Italic-Variable.ttf", import.meta.url),
  );
  assert.ok(italicFont.size > 100_000);
  const regularFont = await stat(
    new URL("../public/fonts/InstrumentSans-Variable.ttf", import.meta.url),
  );
  assert.ok(regularFont.size > 100_000);
});

test("publishes semantic block quotes in articles and RSS", async () => {
  const feed = generateRssFeed([{
    title: "Quote QA",
    slug: "quote-style-qa",
    date: "2026-08-13",
    publishedAt: "2026-08-13T12:00:00.000Z",
    paragraphs: [
      "Before.",
      "## A small heading",
      "> A useful interruption.",
      "- First item.",
      "- Second item.",
      "3. Third item.",
      "4. Fourth item.",
      "After.",
    ],
  }]);
  assert.match(feed, /<h2>A small heading<\/h2>/);
  assert.match(feed, /<blockquote><p>A useful interruption\.<\/p><\/blockquote>/);
  assert.match(feed, /<ul><li>First item\.<\/li><li>Second item\.<\/li><\/ul>/);
  assert.match(feed, /<ol start="3"><li>Third item\.<\/li><li>Fourth item\.<\/li><\/ol>/);
});

test("calculates reading time and preserves draft status", () => {
  assert.equal(calculateReadingTime("word ".repeat(180)), "1 minute read");
  assert.equal(calculateReadingTime("word ".repeat(181)), "2 minute read");
  assert.equal(
    calculateReadingTime("Read [this note](https://example.com/a/very/long/address) *slowly*."),
    "1 minute read",
  );

  const draft = parsePost(serializePost({
    title: "A private thought",
    slug: "a-private-thought",
    date: "2026-08-06",
    status: "draft",
    body: "Not ready yet.",
  }));
  assert.equal(draft.status, "draft");
  assert.equal(draft.readingTime, "1 minute read");
});
