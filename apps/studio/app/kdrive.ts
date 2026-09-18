import {
  parseWritingDocument,
  serializeWritingDocument,
  type WritingDocument,
} from "./content.ts";
import { imageContentType, validImageName } from "./image-files.ts";

const defaultRoot = "/Writing/Write Placid";

export type KdrivePostRef = {
  folder: string;
  type: WritingDocument["type"];
  status: WritingDocument["status"];
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

async function ensureImagesFolder() {
  const config = configuration();
  if (!config) throw new Error("Write Placid KDrive is not configured.");
  const response = await fetch(requestUrl(`${config.root}/Images`), {
    method: "MKCOL",
    headers: headers(),
    cache: "no-store",
  });
  if (![201, 405].includes(response.status)) {
    throw new Error(`KDrive returned ${response.status} while preparing article images.`);
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function safeRelativePath(path: string) {
  if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === ".." || (part.includes("\\") || [...part].some((character) => character.charCodeAt(0) < 32)))) {
    throw new Error("Invalid KDrive editorial path.");
  }
  return path;
}

const editorialFolders = [
  { folder: "Drafts", type: "post", status: "draft" },
  { folder: "Published", type: "post", status: "published" },
  { folder: "Pages", type: "page", status: "published" },
  { folder: "Now/Drafts", type: "now", status: "draft" },
  { folder: "Now/Published", type: "now", status: "published" },
] as const;

async function listFolder(root: typeof editorialFolders[number], folder: string = root.folder): Promise<KdrivePostRef[]> {
  const config = configuration();
  if (!config) return [];
  const response = await kdriveFetch(`${config.root}/${safeRelativePath(folder)}`, {
    method: "PROPFIND",
    headers: { Depth: "1", "Content-Type": "application/xml" },
    body: `<?xml version="1.0"?><propfind xmlns="DAV:"><prop><displayname/><getetag/><resourcetype/></prop></propfind>`,
  }, true);
  if (!response) return [];
  const xml = await response.text();
  if (!/<(?:[^:>]+:)?multistatus\b/i.test(xml)) throw new Error("KDrive did not return a complete directory inventory.");
  const entries: KdrivePostRef[] = [];
  for (const block of xml.match(/<(?:[^:>]+:)?response\b[\s\S]*?<\/(?:[^:>]+:)?response>/gi) || []) {
    const href = block.match(/<(?:[^:>]+:)?href>([\s\S]*?)<\/(?:[^:>]+:)?href>/i)?.[1];
    if (!href) throw new Error("KDrive returned an entry without a path.");
    const pathname = decodeURIComponent(new URL(decodeXml(href), config.url).pathname).replace(/\/+$/, "");
    const parent = `${config.root}/${folder}`;
    if (pathname === parent) continue;
    if (!pathname.startsWith(`${parent}/`)) throw new Error("KDrive returned a path outside the requested folder.");
    const name = pathname.slice(parent.length + 1);
    if (name.includes("/")) throw new Error("KDrive returned an unexpected nested entry.");
    safeRelativePath(name);
    if (/<(?:[^:>]+:)?collection\s*\/?\s*>/i.test(block)) {
      entries.push(...await listFolder(root, `${folder}/${name}`));
    } else if (name.toLowerCase().endsWith(".md")) {
      const etag = block.match(/<(?:[^:>]+:)?getetag>([\s\S]*?)<\/(?:[^:>]+:)?getetag>/i)?.[1] || "";
      if (!etag || decodeXml(etag).startsWith("W/")) throw new Error(`KDrive must provide a strong revision for ${folder}/${name}.`);
      entries.push({ ...root, folder, name, etag: decodeXml(etag) });
    }
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
  const folders = await Promise.all(editorialFolders.map((root) => listFolder(root)));
  return folders.flat().sort((a, b) => `${a.folder}/${a.name}`.localeCompare(`${b.folder}/${b.name}`));
}

export async function readKdriveSource(ref: KdrivePostRef) {
  const config = configuration();
  if (!config) throw new Error("Write Placid KDrive is not configured.");
  const response = await kdriveFetch(`${config.root}/${safeRelativePath(`${ref.folder}/${ref.name}`)}`, { method: "GET", headers: { "If-Match": ref.etag } });
  return response!.text();
}

export async function loadKdrivePost(ref: KdrivePostRef) {
  const source = await readKdriveSource(ref);
  let document: WritingDocument;
  try {
    document = parseWritingDocument(source, `content/${ref.type === "post" ? "posts" : ref.type === "page" ? "pages" : "now"}/${ref.name}`);
  } catch (error) {
    if (source.trimStart().startsWith("---")) throw error;
    document = plainDraft(source, ref.name, "");
  }
  return { ...document, type: ref.type, status: ref.status, aliases: document.aliases || [],
    kdrivePath: `${ref.folder}/${ref.name}`, kdriveEtag: ref.etag,
    remoteSha: "", publishedSource: "" };
}

export async function loadKdrivePosts(cached: WritingDocument[] = []) {
  const refs = await listKdrivePostRefs();
  const byPath = new Map(cached.map((document) => [document.kdrivePath, document]));
  const loadRevision = (ref: KdrivePostRef) => {
    const previous = byPath.get(`${ref.folder}/${ref.name}`);
    // A fresh, strong WebDAV revision verifies cached content. Never use the
    // cache when inventory fails, a file moves, or any revision changes.
    if (previous?.identityPersisted && previous.kdriveEtag === ref.etag && previous.type === ref.type && previous.status === ref.status) {
      return Promise.resolve({ ...previous });
    }
    return loadKdrivePost(ref);
  };
  const documents: WritingDocument[] = [];
  // Limit WebDAV concurrency; validate the entire graph before any mutations.
  for (let offset = 0; offset < refs.length; offset += 5) {
    documents.push(...await Promise.all(refs.slice(offset, offset + 5).map(loadRevision)));
  }
  return documents;
}

export function editorialLocation(document: WritingDocument) {
  const root = editorialFolders.find((folder) => folder.type === document.type && folder.status === document.status)!;
  if (document.kdrivePath) {
    const oldRoot = editorialFolders.find((folder) => document.kdrivePath!.startsWith(`${folder.folder}/`));
    if (!oldRoot || oldRoot.type !== document.type) throw new Error("Invalid editorial folder for document type.");
    return safeRelativePath(`${root.folder}/${document.kdrivePath.slice(oldRoot.folder.length + 1)}`);
  }
  return `${root.folder}/${document.slug}.md`;
}

async function ensureEditorialParent(relativePath: string) {
  const config = configuration()!;
  const parts = safeRelativePath(relativePath).split("/").slice(0, -1);
  for (let index = 1; index <= parts.length; index++) {
    const response = await fetch(requestUrl(`${config.root}/${parts.slice(0, index).join("/")}`), { method: "MKCOL", headers: headers() });
    if (![201, 405].includes(response.status)) throw new Error(`Could not prepare editorial folder (${response.status}).`);
  }
}

export async function saveKdrivePost(document: WritingDocument, previous?: WritingDocument) {
  const config = configuration();
  if (!config) throw new Error("KDrive must be connected before saving editorial content.");
  const destination = editorialLocation(document);
  const prior = previous?.kdrivePath;
  if (previous && prior && !previous.kdriveEtag) throw new Error("Reload this piece before saving: its KDrive revision is missing.");
  await ensureEditorialParent(destination);
  // Conditional MOVE keeps identity and prevents overwriting another document.
  let revision = previous?.kdriveEtag;
  if (prior && prior !== destination) {
    const beforeMove = await kdriveFetch(`${config.root}/${safeRelativePath(prior)}`, { method: "GET", headers: { "If-Match": revision! } });
    const originalSource = await beforeMove!.text();
    await kdriveFetch(`${config.root}/${safeRelativePath(prior)}`, {
      method: "MOVE", headers: { Destination: requestUrl(`${config.root}/${destination}`), Overwrite: "F", "If-Match": previous!.kdriveEtag! },
    });
    const moved = await kdriveFetch(`${config.root}/${destination}`, { method: "GET" });
    if (await moved!.text() !== originalSource) throw new Error("The moved file changed in KDrive. Reload before saving.");
    revision = moved!.headers.get("ETag") || "";
    if (!revision) throw new Error("The folder move succeeded. Reload before editing because KDrive omitted its revision.");
  }
  const response = await kdriveFetch(`${config.root}/${destination}`, {
    method: "PUT",
    headers: { "Content-Type": "text/markdown; charset=utf-8", ...(prior ? { "If-Match": revision! } : { "If-None-Match": "*" }) },
    body: serializeWritingDocument(document),
  });
  document.kdrivePath = destination;
  document.kdriveEtag = response!.headers.get("ETag") || "";
  document.identityPersisted = true;
  // Some WebDAV servers omit ETag on PUT. Read the authoritative new revision.
  if (!document.kdriveEtag) {
    const updated = await kdriveFetch(`${config.root}/${destination}`, { method: "GET" });
    if (await updated!.text() !== serializeWritingDocument(document)) throw new Error("The saved file changed in KDrive. Reload before editing.");
    document.kdriveEtag = updated!.headers.get("ETag") || "";
  }
}

export async function deleteKdrivePost(document: WritingDocument) {
  const config = configuration();
  if (!config || !document.kdrivePath || !document.kdriveEtag) throw new Error("Reload this piece before deleting it from KDrive.");
  const response = await kdriveFetch(`${config.root}/${safeRelativePath(document.kdrivePath)}`, { method: "DELETE", headers: { "If-Match": document.kdriveEtag } });
  return Boolean(response);
}

export async function saveKdriveImage(name: string, bytes: Uint8Array, contentType: string) {
  const config = configuration();
  if (!config || !validImageName(name)) throw new Error("That image name is invalid.");
  await ensureImagesFolder();
  await kdriveFetch(`${config.root}/Images/${name}`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(bytes).buffer,
  });
}

export async function loadKdriveImage(name: string) {
  const config = configuration();
  if (!config || !validImageName(name)) return null;
  const response = await kdriveFetch(`${config.root}/Images/${name}`, { method: "GET" }, true);
  if (!response) return null;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("Content-Type") || imageContentType(name),
  };
}
