import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] || "dist/client");
const missing = new Set();
const globalStylesheets = new Set();
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
    for (const match of html.matchAll(/(?:href|src)="(\/(?:[^"?#]+\/)?_next\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
      const asset = path.join(outputDirectory, decodeURIComponent(match[1]).replace(/^\/+/, ""));
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

console.log(`Static export is complete: ${htmlFiles} HTML files, ${[...globalStylesheets][0]}.`);
