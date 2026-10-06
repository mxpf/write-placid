import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] || "dist/client");
const mountPath = (process.env.STATIC_EXPORT_MOUNT_PATH || "").replace(/\/+$/, "");
const expectedSiteUrl = (process.env.WRITE_PLACID_SITE_URL || "").replace(/\/+$/, "");
const missing = new Set();
const globalStylesheets = new Set();
const placeholderDocuments = new Set();
const invalidCanonicalDocuments = new Set();
let htmlFiles = 0;

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(location);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;

    htmlFiles += 1;
    const html = await readFile(location, "utf8");
    if (expectedSiteUrl) {
      if (html.includes("https://example.com")) placeholderDocuments.add(path.relative(outputDirectory, location));
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      if (canonical && !canonical.startsWith(expectedSiteUrl)) invalidCanonicalDocuments.add(path.relative(outputDirectory, location));
    }
    for (const match of html.matchAll(/(?:href|src)="(\/(?:[^"?#]+\/)?_next\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
      const publicPath = decodeURIComponent(match[1]);
      const mountedPath = mountPath && publicPath.startsWith(`${mountPath}/`)
        ? publicPath.slice(mountPath.length)
        : publicPath;
      const asset = path.join(outputDirectory, mountedPath.replace(/^\/+/, ""));
      try {
        await access(asset);
      } catch {
        missing.add(match[1]);
      }
    }

    for (const match of html.matchAll(
      /href="(\/(?:[^"?#]+\/)?_next\/static\/css\/[\w-]+\.[\w-]+\.css)(?:[?#][^"]*)?"/g,
    )) {
      globalStylesheets.add(match[1]);
    }
  }
}

await visit(outputDirectory);
if (missing.size) {
  throw new Error(`Static export references missing assets:\n${[...missing].join("\n")}`);
}

if (globalStylesheets.size === 0) {
  throw new Error("Static export does not reference a global stylesheet.");
}

if (globalStylesheets.size > 1) {
  throw new Error(
    `Static export contains multiple global stylesheet generations:\n${[...globalStylesheets].join("\n")}`,
  );
}

if (placeholderDocuments.size) {
  throw new Error(`Production export contains placeholder URLs:\n${[...placeholderDocuments].join("\n")}`);
}

if (invalidCanonicalDocuments.size) {
  throw new Error(`Production export contains canonical URLs outside ${expectedSiteUrl}:\n${[...invalidCanonicalDocuments].join("\n")}`);
}

if (expectedSiteUrl) {
  for (const filename of ["rss.xml", "sitemap.xml", "robots.txt"]) {
    const source = await readFile(path.join(outputDirectory, filename), "utf8");
    if (source.includes("https://example.com") || !source.includes(expectedSiteUrl)) {
      throw new Error(`${filename} does not use the deployment URL ${expectedSiteUrl}.`);
    }
  }
}

console.log(`Static export is complete: ${htmlFiles} HTML files, ${[...globalStylesheets][0]}.`);
