import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exports a responsive article layout with a bleed-safe reading measure", async () => {
  const [styles, packageSource] = await Promise.all([
    readFile(new URL("../site/article-layout.css", import.meta.url), "utf8"),
    readFile(new URL("../../../package.json", import.meta.url), "utf8"),
  ]);
  const packageManifest = JSON.parse(packageSource);

  assert.equal(packageManifest.version, "1.6.0");
  assert.equal(
    packageManifest.exports["./article-layout.css"],
    "./packages/core/site/article-layout.css",
  );
  assert.ok(packageManifest.files.includes("packages/core/site/*.css"));
  assert.match(styles, /--article-reading-measure: var\(--reading-measure, 65ch\)/);
  assert.match(styles, /--article-bleed-safe-width: 94\.117647%/);
  assert.match(styles, /inline-size: min\(var\(--article-reading-measure\), var\(--article-bleed-safe-width\)\)/);
  assert.match(styles, /padding-inline: 24px/);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1199px\)/);
  assert.match(styles, /clamp\(108px, calc\(74\.3vw - 462\.6px\), 38%\)/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*inline-size: 100%/);
});
