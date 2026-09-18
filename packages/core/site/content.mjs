import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const documentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publicPathPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const aliasUrlPattern = /^\/[a-z0-9]+(?:-[a-z0-9]+)*\.html$/;

function parseFrontmatter(source) {
  const match = source.replace(/\r\n/g, "\n").match(frontmatterPattern);
  if (!match) throw new Error("Document is missing frontmatter.");
  const metadata = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    metadata[key] = value;
  }
  return { metadata, body: match[2].trim() };
}

function quote(value) {
  return JSON.stringify(value ?? "");
}

function parseAliases(value = "") {
  if (!value) return [];
  let aliases;
  try {
    aliases = JSON.parse(value);
  } catch {
    throw new Error(`Aliases must be a JSON array of root-relative .html URLs: ${value}`);
  }
  if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string")) {
    throw new Error("Aliases must be a JSON array of strings.");
  }
  return aliases;
}

function parseBodyBlocks(body) {
  return body
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!/^(-|\d+\.)\s+/.test(lines[0] || "")) return [lines.join(" ")];
      const items = [];
      for (const line of lines) {
        if (/^(-|\d+\.)\s+/.test(line)) items.push(line);
        else if (items.length) items[items.length - 1] += ` ${line}`;
      }
      return items;
    })
    .filter(Boolean);
}

export function calculateReadingTime(body) {
  const readableBody = body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]/g, "");
  const words = readableBody.trim().match(/[\p{L}\p{N}’'-]+/gu)?.length ?? 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} minute read`;
}

export function displayDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function comparePostsByDate(a, b) {
  return b.date.localeCompare(a.date)
    || (b.publishedAt || "").localeCompare(a.publishedAt || "")
    || a.slug.localeCompare(b.slug);
}

export function parsePost(source, filename = "") {
  const { metadata, body } = parseFrontmatter(source);
  const slug = metadata.slug || filename.replace(/\.md$/, "");
  return {
    type: "post", id: metadata.id || "", publicPath: metadata.publicPath || "", sourcePath: `content/posts/${filename}`,
    title: metadata.title || "Untitled", slug,
    aliases: parseAliases(metadata.aliases),
    date: metadata.date || new Date().toISOString().slice(0, 10),
    publishedAt: metadata.publishedAt || "", updatedAt: metadata.updatedAt || "",
    status: metadata.status === "draft" ? "draft" : "published",
    body, paragraphs: parseBodyBlocks(body), readingTime: calculateReadingTime(body),
    source: metadata.sourceLabel && metadata.sourceHref
      ? { label: metadata.sourceLabel, href: metadata.sourceHref }
      : undefined,
  };
}

export function parseNowEntry(source, filename = "") {
  return { ...parsePost(source, filename), type: "now", sourcePath: `content/now/${filename}`, title: "Now" };
}

export function parsePage(source, filename = "") {
  const { metadata, body } = parseFrontmatter(source);
  const slug = metadata.slug || filename.replace(/\.md$/, "");
  return {
    type: "page", id: metadata.id || "", publicPath: metadata.publicPath || "", sourcePath: `content/pages/${filename}`,
    title: metadata.title || "Untitled", slug,
    aliases: parseAliases(metadata.aliases), body, paragraphs: parseBodyBlocks(body),
  };
}

async function readMarkdownCollection(directory, parser, { optional = false } = {}) {
  let files;
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
  } catch (error) {
    if (!optional || error?.code !== "ENOENT") throw error;
    return [];
  }
  return Promise.all(files.map(async (file) => {
    const source = await readFile(path.join(directory, file), "utf8");
    return parser(source, file);
  }));
}

function documentRoute(document) {
  return document.type === "now" ? "now" : document.slug;
}

function documentUrl(document) {
  return `/${documentRoute(document)}.html`;
}

function normalizeInternalPath(href) {
  return href.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
}

export function validateContentGraph(documents) {
  const ids = new Map();
  const routes = new Map();
  const redirects = new Map();
  for (const document of documents) {
    if (!documentIdPattern.test(document.id)) throw new Error(`${document.slug || "Untitled"} needs an immutable UUID id.`);
    if (ids.has(document.id)) throw new Error(`Duplicate document id ${document.id}: ${ids.get(document.id)} and ${document.slug}.`);
    ids.set(document.id, document.slug);
    if (!publicPathPattern.test(document.publicPath)) throw new Error(`${document.slug} needs a stable .md publicPath.`);
    if (!document.sourcePath.endsWith(`/${document.publicPath}`)) throw new Error(`${document.slug} publicPath must match its snapshot filename.`);
    if (!slugPattern.test(document.slug)) throw new Error(`Invalid slug: ${document.slug}.`);
    const route = documentRoute(document);
    if (routes.has(route)) throw new Error(`Duplicate public slug ${route}: ${routes.get(route)} and ${document.slug}.`);
    routes.set(route, document.slug);
    if (document.type === "now" && document.aliases.length) throw new Error("Now entries cannot declare public aliases because they share /now.");
  }
  for (const document of documents) {
    for (const alias of document.aliases) {
      if (!aliasUrlPattern.test(alias)) throw new Error(`Invalid alias URL ${alias} on ${document.slug}.`);
      const route = normalizeInternalPath(alias);
      if (routes.has(route)) throw new Error(`Alias ${alias} collides with the public slug for ${routes.get(route)}.`);
      if (redirects.has(alias)) throw new Error(`Alias ${alias} is claimed by more than one document.`);
      redirects.set(alias, documentUrl(document));
    }
  }
  for (const start of redirects.keys()) {
    const visited = new Set();
    let url = start;
    while (redirects.has(url)) {
      if (visited.has(url)) throw new Error(`Redirect loop detected at ${url}.`);
      visited.add(url);
      url = redirects.get(url);
    }
  }
  for (const document of documents) {
    for (const match of document.body.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const href = match[1];
      if (href.startsWith("doc:")) {
        const encodedId = href.slice(4).split("#", 1)[0];
        let id;
        try { id = decodeURIComponent(encodedId); } catch { throw new Error(`${document.slug} has a malformed document id link.`); }
        if (!ids.has(id)) throw new Error(`${document.slug} links to unknown document id ${id}.`);
        continue;
      }
      if (!href.startsWith("/") || href.startsWith("/images/")) continue;
      const route = normalizeInternalPath(href);
      if (route && !routes.has(route) && !redirects.has(route)) throw new Error(`${document.slug} links to unknown internal URL ${href}.`);
    }
  }
  return { ids, routes, redirects };
}

export function validateManifestShape(manifest) {
  if (manifest.version !== 1 || !Array.isArray(manifest.documents) || typeof manifest.redirects !== "object" || !manifest.redirects) {
    throw new Error("content/identity-manifest.json must use contract version 1.");
  }
  return manifest;
}

export function validateIdentityManifest(documents, inputManifest) {
  const manifest = validateManifestShape(inputManifest);
  const published = documents.filter((document) => document.type === "page" || document.status === "published");
  const byPath = (a, b) => a.path.localeCompare(b.path);
  const expected = published.map((document) => ({
    id: document.id,
    type: document.type,
    slug: document.slug,
    path: document.sourcePath,
    url: documentUrl(document),
    aliases: document.aliases,
  })).sort(byPath);
  const actual = [...manifest.documents].sort(byPath);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("identity-manifest.json documents do not match the published Markdown snapshot.");
  }
  const expectedRedirects = Object.fromEntries(expected.flatMap((document) => document.aliases.map((alias) => [alias, document.url])));
  const redirectEntries = (redirects) => Object.entries(redirects).sort(([a], [b]) => a.localeCompare(b));
  if (JSON.stringify(redirectEntries(manifest.redirects)) !== JSON.stringify(redirectEntries(expectedRedirects))) {
    throw new Error("identity-manifest.json redirects do not match the published aliases.");
  }
  return manifest;
}

export function resolveDocumentLinks(body, documents) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  return body.replace(/(\]\()doc:([^#)\s]+)(#[^)\s]+)?(\))/gi, (_, open, encodedId, hash = "", close) => {
    let id;
    try { id = decodeURIComponent(encodedId); } catch { throw new Error(`Cannot decode document id ${encodedId}.`); }
    const target = byId.get(id);
    if (!target) throw new Error(`Cannot resolve document id ${id}.`);
    return `${open}/${documentRoute(target)}${hash}${close}`;
  });
}

export function serializePost(post) {
  const metadata = ["---", `title: ${quote(post.title)}`, `id: ${post.id}`, `publicPath: ${post.publicPath}`, `slug: ${post.slug}`, `date: ${post.date}`, `status: ${post.status === "published" ? "published" : "draft"}`];
  if (post.aliases?.length) metadata.push(`aliases: ${JSON.stringify(post.aliases)}`);
  if (post.publishedAt) metadata.push(`publishedAt: ${post.publishedAt}`);
  if (post.updatedAt) metadata.push(`updatedAt: ${post.updatedAt}`);
  if (post.source?.label && post.source?.href) {
    metadata.push(`sourceLabel: ${quote(post.source.label)}`, `sourceHref: ${quote(post.source.href)}`);
  }
  metadata.push("---", "", post.body.trim(), "");
  return metadata.join("\n");
}

export function createContentRepository(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const postsDirectory = path.resolve(options.postsDirectory || path.join(projectRoot, "content", "posts"));
  const pagesDirectory = path.resolve(options.pagesDirectory || path.join(projectRoot, "content", "pages"));
  const nowDirectory = path.resolve(options.nowDirectory || path.join(projectRoot, "content", "now"));
  const manifestPath = path.resolve(options.manifestPath || path.join(projectRoot, "content", "identity-manifest.json"));

  async function readIdentityManifest() {
    return validateManifestShape(JSON.parse(await readFile(manifestPath, "utf8")));
  }

  async function readContentRepository() {
    const [posts, entries, pages, manifest] = await Promise.all([
      readMarkdownCollection(postsDirectory, parsePost),
      readMarkdownCollection(nowDirectory, parseNowEntry, { optional: true }),
      readMarkdownCollection(pagesDirectory, parsePage),
      readIdentityManifest(),
    ]);
    const documents = [...posts, ...entries, ...pages];
    validateContentGraph(documents);
    validateIdentityManifest(documents, manifest);
    return documents.map((document) => {
      const body = resolveDocumentLinks(document.body, documents);
      return { ...document, body, paragraphs: parseBodyBlocks(body) };
    });
  }

  async function readPosts({ includeDrafts = false } = {}) {
    return (await readContentRepository()).filter((document) => document.type === "post")
      .filter((post) => includeDrafts || post.status === "published").sort(comparePostsByDate);
  }

  async function readNowEntries({ includeDrafts = false } = {}) {
    return (await readContentRepository()).filter((document) => document.type === "now")
      .filter((entry) => includeDrafts || entry.status === "published")
      .sort((a, b) => (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date));
  }

  async function readPages() {
    return (await readContentRepository()).filter((document) => document.type === "page");
  }

  return { projectRoot, readContentRepository, readIdentityManifest, readPosts, readNowEntries, readPages };
}
