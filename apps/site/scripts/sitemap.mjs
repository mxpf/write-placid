import { writeFile } from "node:fs/promises";
import path from "node:path";
import { generateSitemap } from "@mxpf/write-placid-core/site";
import config from "../site.config.json" with { type: "json" };
import { projectRoot } from "./content.mjs";

export { generateSitemap } from "@mxpf/write-placid-core/site";

export async function writeSitemap(posts, pages) {
  await Promise.all([
    writeFile(path.join(projectRoot, "public", "sitemap.xml"), generateSitemap(posts, pages, { siteUrl: config.url }), "utf8"),
    writeFile(path.join(projectRoot, "public", "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${config.url}/sitemap.xml\n`, "utf8"),
  ]);
}
