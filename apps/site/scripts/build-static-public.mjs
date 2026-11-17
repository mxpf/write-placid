import { buildStaticPublic } from "@mxpf/write-placid-core/static-public";
import { fileURLToPath } from "node:url";
import config from "../site.config.json" with { type: "json" };

const result = await buildStaticPublic({
  sourceDirectory: fileURLToPath(new URL("../dist/client", import.meta.url)),
  outputDirectory: fileURLToPath(new URL("../dist/static-public", import.meta.url)),
  publicBasePath: process.env.NEXT_PUBLIC_PAGES_BASE_PATH || "",
  canvasColor: config.staticPublic.canvasColor,
  colorScheme: config.staticPublic.colorScheme,
  viewTransitions: config.staticPublic.viewTransitions,
});

console.log(`Built static-public output: ${result.htmlFiles} HTML files, framework reader runtime removed.`);
