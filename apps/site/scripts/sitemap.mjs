import { writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./content.mjs";
import siteConfig from "../site.config.json" with { type: "json" };

const siteUrl = siteConfig.url;

function generateSitemap(posts, pages) {
  const paths = [
    "/",
    "/now",
    ...pages.map(({ slug }) => `/${slug}`),
    ...posts.map(({ slug }) => `/${slug}`),
  ];

  const urls = paths
    .map((pathname) => `  <url><loc>${new URL(pathname, siteUrl).href}</loc></url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export async function writeSitemap(posts, pages) {
  await Promise.all([
    writeFile(
      path.join(projectRoot, "public", "sitemap.xml"),
      generateSitemap(posts, pages),
      "utf8",
    ),
    writeFile(
      path.join(projectRoot, "public", "robots.txt"),
      `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      "utf8",
    ),
  ]);
}
