import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot, readPosts } from "./content.mjs";
import siteConfig from "../site.config.json" with { type: "json" };

const API_URL = "https://webmention.io/api/mentions.jf2";
const SITE_URL = siteConfig.url;
const cachePath = path.join(projectRoot, "data", "webmentions.json");

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function normalizeWebmention(entry) {
  if (!entry || entry["wm-private"] === true) return null;
  const source = safeHttpUrl(entry.url);
  if (!source || source.hostname === new URL(SITE_URL).hostname || source.hostname.endsWith(`.${new URL(SITE_URL).hostname}`)) {
    return null;
  }
  if (source.href.length > 2048 || source.username || source.password) return null;

  const authorName = typeof entry.author?.name === "string" ? entry.author.name.trim() : "";
  const entryName = typeof entry.name === "string" ? entry.name.trim() : "";
  const hostname = source.hostname.replace(/^www\./, "");

  const label = authorName && authorName.toLowerCase() !== "anonymous"
    ? authorName
    : entryName || hostname;

  return {
    url: source.href,
    label: label.slice(0, 120),
    ...(typeof entry["wm-received"] === "string" ? { received: entry["wm-received"] } : {}),
  };
}

export function mergeWebmentions(entries) {
  const unique = new Map();
  for (const entry of entries) {
    const mention = normalizeWebmention(entry);
    if (mention) unique.set(mention.url, mention);
  }

  return [...unique.values()]
    .sort((a, b) => (b.received ?? "").localeCompare(a.received ?? ""))
    .slice(0, 12);
}

async function fetchTarget(target) {
  const url = new URL(API_URL);
  url.searchParams.set("target", target);
  url.searchParams.set("per-page", "100");
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Webmention.io returned ${response.status} for ${target}`);
  const feed = await response.json();
  return Array.isArray(feed.children) ? feed.children : [];
}

async function readCache() {
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf8"));
    return cache && typeof cache.posts === "object" ? cache : { posts: {} };
  } catch {
    return { posts: {} };
  }
}

export async function refreshWebmentions() {
  const [posts, existing] = await Promise.all([readPosts(), readCache()]);
  const next = { posts: { ...existing.posts } };
  let refreshed = 0;

  for (const post of posts) {
    const targets = [
      `${SITE_URL}/${post.slug}`,
      `${SITE_URL}/${post.slug}.html`,
      `${SITE_URL}/${post.slug}/`,
    ];
    const results = await Promise.allSettled(targets.map(fetchTarget));
    if (results.some((result) => result.status === "rejected")) {
      console.warn(`Kept cached Webmentions for ${post.slug}; at least one target could not be refreshed.`);
      continue;
    }

    next.posts[post.slug] = mergeWebmentions(
      results.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    );
    refreshed += 1;
  }

  const liveSlugs = new Set(posts.map((post) => post.slug));
  for (const slug of Object.keys(next.posts)) {
    if (!liveSlugs.has(slug)) delete next.posts[slug];
  }

  await writeFile(cachePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { refreshed, mentions: Object.values(next.posts).flat().length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const result = await refreshWebmentions();
  console.log(`Refreshed ${result.refreshed} posts; ${result.mentions} public mention${result.mentions === 1 ? "" : "s"} cached.`);
}
