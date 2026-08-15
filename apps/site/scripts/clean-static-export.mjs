import { rm } from "node:fs/promises";
import path from "node:path";

// A static deploy must be made from one build generation. Vinext keeps build
// output in these directories, so clear only those generated artifacts before
// producing the Pages bundle. Source files and published content are untouched.
const generatedDirectories = ["dist", ".next", ".vinext"];

await Promise.all(
  generatedDirectories.map((directory) =>
    rm(path.resolve(directory), { recursive: true, force: true }),
  ),
);

console.log("Cleared previous static build artifacts.");
