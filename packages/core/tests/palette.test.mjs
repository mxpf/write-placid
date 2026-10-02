import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const paletteUrl = new URL("../theme/thinkinghaus-v0.6.css", import.meta.url);
const tokensUrl = new URL("../theme/thinkinghaus-v0.6.tokens.json", import.meta.url);

test("pins the complete Thinkinghaus palette v0.6 release", async () => {
  const [css, tokenSource] = await Promise.all([
    readFile(paletteUrl, "utf8"),
    readFile(tokensUrl, "utf8"),
  ]);
  const tokens = JSON.parse(tokenSource);

  assert.equal(tokens.version, "0.6");
  assert.deepEqual(tokens.anchors, {
    charcoal: "#1C1811",
    ivory: "#F4EDDF",
    taupe: "#9C9281",
    body: "#AFADA6",
  });
  assert.equal(tokens.scales.neutral[150], "#D9D2C6");
  assert.equal(tokens.scales.neutral[200], "#D0CBBF");
  assert.equal(tokens.scales.neutral[300], "#BFBCB3");
  assert.match(css, /Thinkinghaus palette v0\.6/);
  assert.match(css, /--th-neutral-0: #F4EDDF/);
  assert.match(css, /--th-neutral-1000: #1C1811/);
});

test("keeps every published functional contrast check passing", async () => {
  const tokens = JSON.parse(await readFile(tokensUrl, "utf8"));
  const functional = tokens.contrastChecks.filter((check) => check.role !== "text-faint");

  assert.equal(functional.length, 106);
  assert.ok(functional.every((check) => check.pass));
  assert.ok(functional.every((check) => check.ratio >= check.target));
});

test("maps light and dark interface roles to the approved accents and fills", async () => {
  const tokens = JSON.parse(await readFile(tokensUrl, "utf8"));

  assert.equal(tokens.modes.light.link, "neutral-800");
  assert.equal(tokens.modes.light.focus, "ochre-600");
  assert.equal(tokens.modes.light.success, "moss-600");
  assert.equal(tokens.modes.light.error, "clay-600");
  assert.equal(tokens.modes.dark.link, "body");
  assert.equal(tokens.modes.dark.focus, "ochre-400");
  assert.equal(tokens.modes.dark.success, "moss-400");
  assert.equal(tokens.modes.dark.error, "clay-400");
  assert.deepEqual(tokens.fills, {
    "clay-solid": "#9B4127",
    "ochre-solid": "#75591C",
    "moss-solid": "#536431",
    "patina-solid": "#3B655C",
  });
});

test("product surfaces consume semantic roles and retain visible interaction states", async () => {
  const [site, studio, tracking, oauth] = await Promise.all([
    readFile(new URL("../../../apps/site/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../studio/studio.css", import.meta.url), "utf8"),
    readFile(new URL("../../../apps/trackinghaus/src/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../../apps/drafts-mcp/src/workers-oauth-utils.ts", import.meta.url), "utf8"),
  ]);

  assert.match(site, /--blog-link: var\(--th-link\)/);
  assert.match(site, /outline: 2px solid var\(--th-focus\)/);
  assert.match(site, /\.article-body a,\s*\.article-body a:visited\s*\{[^}]*color: inherit;[^}]*text-decoration: underline;/s);
  assert.match(site, /\.article-body a:hover,[\s\S]*color: var\(--blog-foreground\)/);
  assert.match(studio, /--green: var\(--th-success\)/);
  assert.match(studio, /--danger: var\(--th-error\)/);
  assert.match(studio, /border-color: var\(--focus\)/);
  assert.match(studio, /:disabled[\s\S]*opacity:/);
  assert.match(studio, /\.body-input a,\s*\.body-input a:visited\s*\{[^}]*color: inherit;[^}]*text-decoration: underline;/s);
  assert.match(tracking, /--link: #afada6/i);
  assert.match(tracking, /\.inline-link\s*\{[^}]*color: var\(--link\);[^}]*text-decoration: underline;/s);
  assert.match(tracking, /\.inline-link:visited\s*\{[^}]*color: var\(--link\);/s);
  assert.match(tracking, /outline: 2px solid var\(--focus\)/);
  assert.match(oauth, /--link-color: #474135/i);
  assert.match(oauth, /--error-color: #9b4127/i);
  assert.match(oauth, /outline: 2px solid var\(--focus-color\)/);
});
