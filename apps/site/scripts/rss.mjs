import { writeFile } from "node:fs/promises";
import path from "node:path";
import { generateRssFeed as generateCoreRssFeed } from "@mxpf/write-placid-core/site";
import { projectRoot } from "./content.mjs";
import { siteConfig } from "./site-config.mjs";

export function generateRssFeed(posts, nowEntries = [], options = {}) {
  return generateCoreRssFeed(posts, nowEntries, {
    siteName: siteConfig.name,
    siteUrl: siteConfig.url,
    description: siteConfig.description,
    rssPath: "/rss.xml",
    language: siteConfig.language,
    feedId: siteConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    ...options,
  });
}

export async function writeRssFeed(posts, nowEntries = []) {
  await writeFile(path.join(projectRoot, "public", "rss.xml"), generateRssFeed(posts, nowEntries), "utf8");
}
