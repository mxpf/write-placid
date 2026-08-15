import { copyFile, readdir } from "node:fs/promises";
import path from "node:path";

// GitHub Pages can briefly serve an older cached HTML document after a static
// deployment. Keep this one retired filename available during that window so a
// cached document still receives the current site styles instead of browser
// defaults. New builds always use the current hashed stylesheet.
const stylesheetDirectory = path.resolve("dist/client/_next/static/css");
const cachedStylesheetName = "index.BcckSQMS.css";
const stylesheetNames = await readdir(stylesheetDirectory);
const currentStylesheetName = stylesheetNames.find(
  (name) => /^[\w-]+\.[\w-]+\.css$/.test(name) && name !== cachedStylesheetName,
);

if (!currentStylesheetName) {
  throw new Error("Could not find the current global stylesheet to support cached pages.");
}

await copyFile(
  path.join(stylesheetDirectory, currentStylesheetName),
  path.join(stylesheetDirectory, cachedStylesheetName),
);

console.log(`Kept ${cachedStylesheetName} available for cached pages.`);
