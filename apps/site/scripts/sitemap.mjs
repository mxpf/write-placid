import { writeFile } from "node:fs/promises";
import path from "node:path";
import { generateSitemap } from "@mxpf/write-placid-core/site";
import { projectRoot } from "./content.mjs";
import { siteConfig } from "./site-config.mjs";

export { generateSitemap } from "@mxpf/write-placid-core/site";

export async function writeSitemap(posts, pages) {
  await Promise.all([
    writeFile(path.join(projectRoot, "public", "sitemap.xml"), generateSitemap(posts, pages, { siteUrl: siteConfig.url }), "utf8"),
    writeFile(path.join(projectRoot, "public", "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteConfig.url}/sitemap.xml\n`, "utf8"),
  ]);
}
