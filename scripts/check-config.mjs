import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const skipped = new Set([".git", "node_modules", "dist", ".next", ".vinext", ".wrangler"]);
const problems = [];
const knownInfrastructureIds = [
  ["2cc83d1a", "5787", "43d0", "bb1b", "693a57b36fd3"].join("-"),
  ["161a2f40", "16044bd6", "89ce566c", "bf935116"].join(""),
];
const knownAccountValues = [
  ["maxpfennighaus", "gmail.com"].join("@"),
  ["flaringhaus", "cloudflareaccess.com"].join("."),
];
const knownTemplateLeaks = [
  "https://thinking.haus",
  "thinkinghaus-studio",
  "maxpfennig.haus",
  "Untitled Sans",
  "/03 Projects/Writing/Thinkinghaus",
];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(location);
      continue;
    }
    if (!/\.(?:js|mjs|ts|tsx|jsx|json|jsonc|md|yml|yaml|txt|css|html|sql|gs)$/.test(entry.name)) continue;
    const source = await readFile(location, "utf8");
    const relative = path.relative(root, location);
    if (/gh[pousr]_[A-Za-z0-9_]{20,}/.test(source)) problems.push(`${relative}: looks like a GitHub token`);
    if (knownInfrastructureIds.some((value) => source.includes(value))) problems.push(`${relative}: contains a live infrastructure ID`);
    if (knownAccountValues.some((value) => source.includes(value))) problems.push(`${relative}: contains a personal account value`);
    if (relative.startsWith(`apps${path.sep}`) && knownTemplateLeaks.some((value) => source.includes(value))) {
      problems.push(`${relative}: contains upstream identity or licensed-asset configuration`);
    }
  }
}

await walk(root);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Configuration scan passed: no known credentials or live infrastructure IDs found.");
}
