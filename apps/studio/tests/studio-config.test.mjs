import assert from "node:assert/strict";
import test from "node:test";
import { liveCheckUrl } from "../app/studio-config.ts";

const updatedAt = "2026-11-17T12:00:00.000Z";

test("live checks keep the publication path with or without a trailing slash", () => {
  const origin = "https://example.com";
  for (const [siteUrl, prefix] of [
    [origin, ""],
    [`${origin}/`, ""],
    [`${origin}/write-placid`, "/write-placid"],
    [`${origin}/write-placid/`, "/write-placid"],
    [`${origin}/notes/write-placid/`, "/notes/write-placid"],
  ]) {
    for (const path of ["/first-post.html", "/now.html", "/write-placid-publication.json"]) {
      const url = liveCheckUrl(siteUrl, path, updatedAt);
      assert.equal(url.origin, origin);
      assert.equal(url.pathname, prefix + path);
      assert.equal(url.searchParams.get("studio-check"), updatedAt);
    }
  }
});

test("live checks replace the query and fragment from the configured site URL", () => {
  const url = liveCheckUrl("https://example.com/write-placid?preview=1#edit", "/first-post.html", updatedAt);
  assert.equal(url.href, "https://example.com/write-placid/first-post.html?studio-check=2026-11-17T12%3A00%3A00.000Z");
});
