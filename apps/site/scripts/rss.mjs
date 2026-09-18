import { writeFile } from "node:fs/promises";
import path from "node:path";
import { generateRssFeed as generateCoreRssFeed } from "@mxpf/write-placid-core/site";
import config from "../site.config.json" with { type: "json" };
import { projectRoot } from "./content.mjs";

export function generateRssFeed(posts, nowEntries = [], options = {}) {
  return generateCoreRssFeed(posts, nowEntries, {
    siteName: config.name,
    siteUrl: config.url,
    description: config.description,
    rssPath: "/rss.xml",
    language: config.language,
    feedId: config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    ...options,
  });
}

export async function writeRssFeed(posts, nowEntries = []) {
  await writeFile(path.join(projectRoot, "public", "rss.xml"), generateRssFeed(posts, nowEntries), "utf8");
}
