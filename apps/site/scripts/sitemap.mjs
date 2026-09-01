import { writeFile } from "node:fs/promises";
import path from "node:path";
import { SITE_URL } from "../site-config.mjs";
import { projectRoot } from "./content.mjs";

function generateSitemap(posts, pages) {
  const paths = [
    "/",
    "/now",
    ...pages.map(({ slug }) => `/${slug}`),
    ...posts.map(({ slug }) => `/${slug}`),
  ];

  const urls = paths
    .map((pathname) => `  <url><loc>${new URL(pathname, SITE_URL).href}</loc></url>`)
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
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      "utf8",
    ),
  ]);
}
