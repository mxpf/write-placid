import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStaticPublic, verifyStaticPublic } from "../site/static-public.mjs";

test("static-public build removes only framework reader runtime and preserves document contracts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "write-placid-static-public-"));
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  await mkdir(path.join(source, "_next", "static", "chunks"), { recursive: true });
  await writeFile(path.join(source, "_next", "static", "chunks", "framework.js"), "framework");
  await writeFile(path.join(source, "page.rsc"), "payload");
  await writeFile(path.join(source, "rss.xml"), "<rss>preserved</rss>");
  await writeFile(path.join(source, "index.html"), `<!doctype html><html><head><link rel="modulepreload" href="/journal/_next/static/chunks/framework.js"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">{"name":"Example"}</script></head><body><main>Semantic content</main><script defer src="/author-mode.js"></script><script defer src="https://tracker.example/tracker.js" data-site="example"></script><script src="/journal/_next/static/chunks/framework.js" type="module"></script><script>Object.assign((self[Symbol.for("vinext.navigationRuntime")]??={}),{})</script></body></html>`);

  const result = await buildStaticPublic({
    sourceDirectory: source,
    outputDirectory: output,
    publicBasePath: "/journal",
    canvasColor: "#1a1814",
    colorScheme: "dark",
    enhancements: { footerSelector: ".ending" },
  });
  assert.equal(result.htmlFiles, 1);
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.match(html, /<head><style data-write-placid-static-shell>:root\{color-scheme:dark;background:#1a1814\}/);
  assert.match(html, /@media \(prefers-reduced-motion:no-preference\)\{@view-transition\{navigation:auto\}\}/);
  assert.match(html, /type="application\/ld\+json"/);
  assert.match(html, /author-mode\.js/);
  assert.match(html, /tracker\.example\/tracker\.js/);
  assert.match(html, /<main>Semantic content<\/main>/);
  assert.doesNotMatch(html, /vinext\.navigationRuntime|modulepreload|_next\/static\/chunks/);
  assert.match(html, /src="\/journal\/write-placid-enhancements\.mjs"/);
  assert.equal(await readFile(path.join(output, "rss.xml"), "utf8"), "<rss>preserved</rss>");
  const entry = await readFile(path.join(output, "write-placid-enhancements.mjs"), "utf8");
  assert.match(entry, /"footerSelector":"\.ending"/);
  await verifyStaticPublic({ outputDirectory: output, publicBasePath: "/journal" });
});

test("static-public shell rejects unsafe instance configuration", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "write-placid-static-public-"));
  const source = path.join(root, "source");
  await mkdir(source);
  await writeFile(path.join(source, "index.html"), "<html><head></head><body></body></html>");
  await assert.rejects(() => buildStaticPublic({
    sourceDirectory: source,
    outputDirectory: path.join(root, "output"),
    canvasColor: "red}</style><script>",
  }), /safe CSS color/);
});
