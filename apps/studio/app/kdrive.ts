import {
  parseWritingDocument,
  serializeWritingDocument,
  type WritingDocument,
} from "./content";

const defaultRoot = "/Writing/Write Placid";

export type KdrivePostRef = {
  folder: "Drafts" | "Published";
  name: string;
  etag: string;
};

function configuration() {
  const url = process.env.WRITE_PLACID_KDRIVE_WEBDAV_URL?.trim().replace(/\/+$/, "");
  const username = process.env.WRITE_PLACID_KDRIVE_USERNAME?.trim();
  const password = process.env.WRITE_PLACID_KDRIVE_APP_PASSWORD?.trim();
  const root = (process.env.WRITE_PLACID_KDRIVE_ROOT || defaultRoot).trim().replace(/\/+$/, "");
  if (!url || !username || !password) return null;
  return { url, username, password, root };
}

export function kdriveConfigured() {
  return Boolean(configuration());
}

function encodePath(pathname: string) {
  return pathname.split("/").map(encodeURIComponent).join("/");
}

function requestUrl(pathname: string) {
  const config = configuration();
  if (!config) throw new Error("Write Placid KDrive is not configured.");
  return `${config.url}${encodePath(pathname)}`;
}

function headers(extra: HeadersInit = {}) {
  const config = configuration();
  if (!config) throw new Error("Write Placid KDrive is not configured.");
  return {
    Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
    ...extra,
  };
}

async function kdriveFetch(pathname: string, init: RequestInit, allowNotFound = false) {
  const response = await fetch(requestUrl(pathname), {
    ...init,
    headers: headers(init.headers),
    cache: "no-store",
  });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`KDrive returned ${response.status} while accessing ${pathname}.`);
  }
  return response;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function listFolder(folder: "Drafts" | "Published") {
  const config = configuration();
  if (!config) return [];
  const path = `${config.root}/${folder}`;
  const response = await kdriveFetch(path, {
    method: "PROPFIND",
    headers: { Depth: "1", "Content-Type": "application/xml" },
    body: `<?xml version="1.0"?><propfind xmlns="DAV:"><prop><displayname/><getetag/><resourcetype/></prop></propfind>`,
  });
  if (!response) return [];
  const xml = await response.text();
  const entries: Omit<KdrivePostRef, "folder">[] = [];
  for (const block of xml.match(/<(?:[^:>]+:)?response\b[\s\S]*?<\/(?:[^:>]+:)?response>/gi) || []) {
    if (/<(?:[^:>]+:)?collection\s*\/?\s*>/i.test(block)) continue;
    const name = block.match(/<(?:[^:>]+:)?displayname>([\s\S]*?)<\/(?:[^:>]+:)?displayname>/i)?.[1];
    if (!name || !name.toLowerCase().endsWith(".md")) continue;
    const etag = block.match(/<(?:[^:>]+:)?getetag>([\s\S]*?)<\/(?:[^:>]+:)?getetag>/i)?.[1] || "";
    entries.push({ name: decodeXml(name), etag: decodeXml(etag).replace(/^W\//, "").replace(/^"|"$/g, "") });
  }
  return entries;
}

function plainDraft(source: string, name: string, etag: string): WritingDocument {
  const title = source.match(/^#\s+(.+)$/m)?.[1].trim() || name.replace(/\.md$/i, "");
  const slug = name.replace(/\.md$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const path = `content/posts/${slug}.md`;
  return {
    id: path,
    path,
    type: "post",
    slug,
    title,
    date: new Date().toISOString().slice(0, 10),
    status: "draft",
    publishedAt: "",
    publicUpdatedAt: "",
    body: source.replace(/^#\s+.+\n+/, "").trim(),
    remoteSha: etag,
    publishedSource: "",
    updatedAt: new Date().toISOString(),
    googleDocId: "",
    driveRevision: "",
    driveSyncedBody: "",
  };
}

export async function listKdrivePostRefs() {
  const config = configuration();
  if (!config) return [];
  const folders = await Promise.all([listFolder("Drafts"), listFolder("Published")]);
  return folders
    .flatMap((entries, index) => entries.map((entry) => ({
      ...entry,
      folder: index === 0 ? "Drafts" as const : "Published" as const,
    })))
    .sort((left, right) =>
      `${left.folder}/${left.name}`.localeCompare(`${right.folder}/${right.name}`),
    );
}

export async function loadKdrivePost(ref: KdrivePostRef) {
  const config = configuration();
  if (!config) throw new Error("Write Placid KDrive is not configured.");
  const response = await kdriveFetch(`${config.root}/${ref.folder}/${ref.name}`, { method: "GET" });
  const source = await response!.text();
  try {
    const document = parseWritingDocument(source, `content/posts/${ref.name}`, ref.etag);
    return { ...document, status: ref.folder === "Drafts" ? "draft" as const : "published" as const };
  } catch (error) {
    if (source.trimStart().startsWith("---")) throw error;
    return plainDraft(source, ref.name, ref.etag);
  }
}

export async function loadKdrivePosts() {
  const refs = await listKdrivePostRefs();
  return Promise.all(refs.map(loadKdrivePost));
}

function location(document: WritingDocument) {
  const config = configuration();
  if (!config) throw new Error("Write Placid KDrive is not configured.");
  const folder = document.status === "published" ? "Published" : "Drafts";
  return `${config.root}/${folder}/${document.slug}.md`;
}

export async function saveKdrivePost(document: WritingDocument, previous?: WritingDocument) {
  if (document.type !== "post" || !configuration()) return;
  const destination = location(document);
  await kdriveFetch(destination, {
    method: "PUT",
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
    body: serializeWritingDocument(document),
  });
  if (previous) {
    const prior = location(previous);
    if (prior !== destination) await kdriveFetch(prior, { method: "DELETE" }, true);
  }
}

export async function deleteKdrivePost(document: WritingDocument) {
  if (document.type !== "post" || !configuration()) return false;
  const response = await kdriveFetch(location(document), { method: "DELETE" }, true);
  return Boolean(response);
}
