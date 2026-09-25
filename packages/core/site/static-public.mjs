import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreDirectory = dirname(fileURLToPath(import.meta.url));
const assetNames = {
  runtime: "write-placid-static-public.mjs",
  entry: "write-placid-enhancements.mjs",
  fade: "write-placid-scroll-fade.mjs",
};

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(location));
    else files.push(location);
  }
  return files;
}

function validateShell({ canvasColor, colorScheme }) {
  if (!/^[#(),.%\s\w-]+$/.test(canvasColor) || /[;{}<>]/.test(canvasColor)) throw new Error("staticPublic.canvasColor is not a safe CSS color");
  if (!/^(normal|light|dark|light dark|dark light)$/.test(colorScheme)) throw new Error("staticPublic.colorScheme is invalid");
}

function earlyShell({ canvasColor, colorScheme, viewTransitions }) {
  const canvas = `:root{color-scheme:${colorScheme};background:${canvasColor}}html,body{background:${canvasColor}}`;
  const transition = viewTransitions ? "@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}" : "";
  return `<style data-write-placid-static-shell>${canvas}${transition}</style>`;
}

function stripFrameworkRuntime(html) {
  return html
    .replace(/<link\b[^>]*rel="modulepreload"[^>]*href="[^"]*\/_next\/static\/chunks\/[^"]+"[^>]*\/?>(?:\s*)/gi, "")
    .replace(/<script\b[^>]*src="[^"]*\/_next\/static\/chunks\/[^"]+"[^>]*>[\s\S]*?<\/script>(?:\s*)/gi, "")
    .replace(/<script\b[^>]*>(?=[\s\S]*?<\/script>)(?:(?!<\/script>)[\s\S])*(?:vinext\.navigationRuntime|self\.__next_f)(?:(?!<\/script>)[\s\S])*<\/script>(?:\s*)/gi, "");
}

export async function buildStaticPublic(options) {
  const sourceDirectory = resolve(options.sourceDirectory);
  const outputDirectory = resolve(options.outputDirectory);
  if (sourceDirectory === outputDirectory) throw new Error("Static-public source and output directories must differ");
  const shell = {
    canvasColor: options.canvasColor ?? "#ffffff",
    colorScheme: options.colorScheme ?? "light",
    viewTransitions: options.viewTransitions !== false,
  };
  validateShell(shell);
  const publicBasePath = `/${String(options.publicBasePath ?? "").replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "");
  const assetUrl = (name) => `${publicBasePath}/${name}`;

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(dirname(outputDirectory), { recursive: true });
  await cp(sourceDirectory, outputDirectory, { recursive: true });

  let files = await walk(outputDirectory);
  for (const file of files) {
    const path = relative(outputDirectory, file);
    if (file.endsWith(".rsc") || path.includes(join("_next", "static", "chunks"))) await rm(file, { force: true });
  }

  const entrySource = `import { enhanceStaticPublic } from ${JSON.stringify(`./${assetNames.runtime}`)};\nenhanceStaticPublic(${JSON.stringify(options.enhancements ?? {})});\n`;
  await Promise.all([
    cp(join(coreDirectory, "static-public-browser.mjs"), join(outputDirectory, assetNames.runtime)),
    cp(join(coreDirectory, "scroll-fade.mjs"), join(outputDirectory, assetNames.fade)),
    writeFile(join(outputDirectory, assetNames.entry), entrySource),
  ]);
  let runtime = await readFile(join(outputDirectory, assetNames.runtime), "utf8");
  runtime = runtime.replace('from "./scroll-fade.mjs"', `from "./${assetNames.fade}"`);
  await writeFile(join(outputDirectory, assetNames.runtime), runtime);

  files = await walk(outputDirectory);
  for (const file of files.filter((path) => path.endsWith(".html"))) {
    let html = stripFrameworkRuntime(await readFile(file, "utf8"));
    if (!html.includes("data-write-placid-static-shell")) html = html.replace(/<head>/i, `<head>${earlyShell(shell)}`);
    if (!html.includes(assetNames.entry)) html = html.replace(/<\/body>/i, `<script type="module" src="${assetUrl(assetNames.entry)}"></script></body>`);
    await writeFile(file, html);
  }

  return verifyStaticPublic({ outputDirectory, publicBasePath });
}

export async function verifyStaticPublic({ outputDirectory, publicBasePath = "" }) {
  const root = resolve(outputDirectory);
  const files = await walk(root);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const violations = [];
  for (const file of files) {
    const path = relative(root, file);
    if (file.endsWith(".rsc") || path.includes(join("_next", "static", "chunks"))) violations.push(path);
  }
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    if (/rel="modulepreload"[^>]+\/_next\/static\/chunks|vinext\.navigationRuntime|self\.__next_f|\/_next\/static\/chunks\//.test(html)) violations.push(`${basename(file)}: framework bootstrap remains`);
    if (!html.includes("data-write-placid-static-shell")) violations.push(`${basename(file)}: early shell missing`);
    if (!html.includes(`${publicBasePath}/${assetNames.entry}`)) violations.push(`${basename(file)}: enhancement entry missing`);
  }
  if (violations.length) throw new Error(`Static-public verification failed:\n${violations.join("\n")}`);
  return { htmlFiles: htmlFiles.length, files: files.length, frameworkRuntimeRemoved: true };
}
