import { snapshotPath, serializeWritingDocument, type WritingDocument } from "./content.ts";

export function publicUrl(document: WritingDocument) {
  return document.type === "now" ? "/now.html" : `/${document.slug}.html`;
}

export function internalReferences(body: string) {
  return [...body.matchAll(/\]\(doc:([^\s)#]+)(?:#[^\s)]*)?\)/g)].map((match) => decodeURIComponent(match[1]));
}

export function validateRepository(documents: WritingDocument[]) {
  const errors: string[] = [];
  const ids = new Map<string, WritingDocument>();
  const paths = new Set<string>();
  const slugs = new Set<string>();
  const urls = new Map<string, string>();
  const redirects = new Map<string, string>();
  for (const document of documents) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(document.id)) errors.push(`Invalid ID: ${document.id}`);
    if (ids.has(document.id)) errors.push(`Duplicate ID: ${document.id}`);
    ids.set(document.id, document);
    try {
      if (snapshotPath(document.type, document.publicPath || document.path.split("/").at(-1) || "") !== document.path) errors.push(`Snapshot path does not match publicPath: ${document.path}`);
    } catch (error) { errors.push(String(error)); }

    if (slugs.has(document.slug)) errors.push(`Duplicate slug: ${document.slug}`);
    slugs.add(document.slug);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(document.slug)) errors.push(`Invalid slug: ${document.slug}`);
    if (!/^content\/(posts|pages|now)\/[a-z0-9][a-z0-9._-]*\.md$/.test(document.path)) errors.push(`Invalid snapshot path: ${document.path}`);
    const directory = document.type === "post" ? "posts" : document.type === "page" ? "pages" : "now";
    if (!document.path.startsWith(`content/${directory}/`)) errors.push(`Snapshot path has wrong document type: ${document.path}`);
    if (paths.has(document.path)) errors.push(`Duplicate snapshot path: ${document.path}`);
    paths.add(document.path);
    // Now entries intentionally share an aggregate public URL.
    if (document.type !== "now" && ["now", "index"].includes(document.slug)) errors.push(`Reserved public URL: ${document.slug}`);
    const url = document.type === "now" ? `now:${document.slug}` : publicUrl(document);
    if (urls.has(url)) errors.push(`Duplicate slug/URL: ${url}`);
    urls.set(url, document.id);
  }
  for (const document of documents) {
    if (document.legacyIds && (!Array.isArray(document.legacyIds) || document.legacyIds.some((id) => typeof id !== "string" || !id))) { errors.push(`Invalid legacyIds: ${document.id}`); continue; }
    for (const id of document.legacyIds || []) {
      if (ids.has(id) && ids.get(id)!.id !== document.id) errors.push(`Legacy ID collision: ${id}`);
      ids.set(id, document);
    }
  }
  for (const document of documents) {
    if (!Array.isArray(document.aliases)) { errors.push(`Invalid aliases: ${document.id}`); continue; }
    for (const alias of document.aliases) {
      if (typeof alias !== "string" || !/^\/[a-z0-9][a-z0-9/_-]*\.html$/.test(alias)) errors.push(`Invalid alias: ${alias}`);
      if (urls.has(alias) || alias === "/now.html" || redirects.has(alias)) errors.push(`Alias collision: ${alias}`);
      redirects.set(alias, publicUrl(document));
    }
    for (const id of internalReferences(document.body + (document.source?.href ? ` [source](${document.source.href})` : ""))) {
      const target = ids.get(id);
      if (!target) errors.push(`Unresolved internal reference: ${document.id} -> ${id}`);
      else if (document.status === "published" && target.status !== "published") errors.push(`Published document references private document: ${document.id} -> ${id}`);
    }
  }
  for (const start of redirects.keys()) {
    const seen = new Set<string>();
    let cursor: string | undefined = start;
    while (cursor && redirects.has(cursor)) {
      if (seen.has(cursor)) { errors.push(`Redirect loop: ${start}`); break; }
      seen.add(cursor);
      cursor = redirects.get(cursor);
    }
  }
  return [...new Set(errors)];
}

export function assertValidRepository(documents: WritingDocument[]) {
  const errors = validateRepository(documents);
  if (errors.length) throw new Error(errors.join("\n"));
}

export function buildPublicSnapshot(documents: WritingDocument[]) {
  assertValidRepository(documents);
  const byId = new Map(documents.flatMap((document) => [document.id, ...(document.legacyIds || [])].map((id) => [id, document] as const)));
  const published = documents.filter((document) => document.status === "published");
  const files: Record<string, string> = {};
  for (const document of published) {
    const body = document.body.replace(/\]\(doc:([^\s)#]+)(#[^\s)]*)?\)/g, (_, id, fragment = "") =>
      `](${publicUrl(byId.get(decodeURIComponent(id))!)}${fragment})`);
    const source = document.source?.href.startsWith("doc:")
      ? { ...document.source, href: document.source.href.replace(/^doc:([^#]+)(#.*)?$/, (_, id, fragment = "") => `${publicUrl(byId.get(decodeURIComponent(id))!)}${fragment}`) }
      : document.source;
    files[snapshotPath(document.type, document.publicPath || document.path.split("/").at(-1)!)] = serializeWritingDocument({ ...document, body, source, legacyIds: [] });
  }
  const manifest = {
    version: 1,
    documents: published.map((document) => ({ id: document.id, type: document.type, slug: document.slug, path: document.path, url: publicUrl(document), aliases: document.aliases || [] })),
    redirects: Object.fromEntries(published.flatMap((document) => (document.aliases || []).map((alias) => [alias, publicUrl(document)]))),
  };
  files["content/identity-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
  return { manifest, files };
}
