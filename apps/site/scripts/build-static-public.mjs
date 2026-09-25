import { buildStaticPublic } from "@mxpf/write-placid-core/static-public";
import config from "../site.config.json" with { type: "json" };

const result = await buildStaticPublic({
  sourceDirectory: new URL("../dist/client", import.meta.url).pathname,
  outputDirectory: new URL("../dist/static-public", import.meta.url).pathname,
  publicBasePath: process.env.NEXT_PUBLIC_PAGES_BASE_PATH || "",
  canvasColor: config.staticPublic.canvasColor,
  colorScheme: config.staticPublic.colorScheme,
  viewTransitions: config.staticPublic.viewTransitions,
});

console.log(`Built static-public output: ${result.htmlFiles} HTML files, framework reader runtime removed.`);
