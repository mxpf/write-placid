export type WritingDocument = {
  id: string;
  path: string;
  type: "post" | "page" | "now";
  slug: string;
  title: string;
  date: string;
  status: "draft" | "published";
  publishedAt: string;
  body: string;
  source?: {
    label: string;
    href: string;
  };
  remoteSha: string;
  publishedSource: string;
  updatedAt: string;
  googleDocId: string;
  driveRevision: string;
  driveSyncedBody: string;
};

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseFrontmatter(source: string) {
  const match = source.replace(/\r\n/g, "\n").match(frontmatterPattern);
  if (!match) throw new Error("This document is missing its frontmatter.");

  const metadata: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    metadata[key] = value;
  }

  return { metadata, body: match[2].trim() };
}

function quote(value: string) {
  return JSON.stringify(value ?? "");
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function calculateReadingTime(body: string) {
  const readableBody = body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]/g, "");
  const words = readableBody.trim().match(/[\p{L}\p{N}’'-]+/gu)?.length ?? 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} minute read`;
}

export function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function parseWritingDocument(
  source: string,
  path: string,
  remoteSha = "",
): WritingDocument {
  const { metadata, body } = parseFrontmatter(source);
  const type = path.includes("/pages/")
    ? "page"
    : path.includes("/now/")
      ? "now"
      : "post";
  const slug = metadata.slug || path.split("/").pop()?.replace(/\.md$/, "") || "";

  return {
    id: path,
    path,
    type,
    slug,
    title: metadata.title || "Untitled",
    date: type !== "page" ? metadata.date || new Date().toISOString().slice(0, 10) : "",
    status: type !== "page" && metadata.status === "draft" ? "draft" : "published",
    publishedAt: metadata.publishedAt || "",
    body,
    source:
      metadata.sourceLabel && metadata.sourceHref
        ? { label: metadata.sourceLabel, href: metadata.sourceHref }
        : undefined,
    remoteSha,
    publishedSource: source.trim(),
    updatedAt: new Date().toISOString(),
    googleDocId: "",
    driveRevision: "",
    driveSyncedBody: body,
  };
}

export function serializeWritingDocument(document: WritingDocument) {
  const metadata = [
    "---",
    `title: ${quote(document.title.trim() || "Untitled")}`,
    `slug: ${document.slug}`,
  ];

  if (document.type !== "page") {
    metadata.push(
      `date: ${document.date || new Date().toISOString().slice(0, 10)}`,
      `status: ${document.status}`,
    );
    if (document.publishedAt) {
      metadata.push(`publishedAt: ${document.publishedAt}`);
    }
    if (document.source?.label && document.source?.href) {
      metadata.push(`sourceLabel: ${quote(document.source.label.trim())}`);
      metadata.push(`sourceHref: ${quote(document.source.href.trim())}`);
    }
  }

  metadata.push("---", "", document.body.trim(), "");
  return metadata.join("\n");
}

export function normalizeIncomingDocument(
  input: Partial<WritingDocument>,
  existing?: WritingDocument,
): WritingDocument {
  const type = input.type === "page" ? "page" : input.type === "now" ? "now" : "post";
  const title = String(input.title || "").trim() || (type === "now" ? "Now" : "Untitled");
  const date = String(input.date || existing?.date || new Date().toISOString().slice(0, 10));
  const slug =
    type === "page"
      ? existing?.slug || slugify(String(input.slug || title))
      : type === "now"
        ? existing?.slug || slugify(String(input.slug || `now-${date}-${Date.now()}`))
        : slugify(title);
  if (!slug) throw new Error("Give this piece a title first.");

  const path =
    type === "page"
      ? existing?.path || `content/pages/${slug}.md`
      : type === "now"
        ? existing?.path || `content/now/${slug}.md`
        : `content/posts/${slug}.md`;

  if (type === "page" && !["about", "links"].includes(slug)) {
    throw new Error("Only the About and Links pages can be edited here.");
  }

  const source =
    input.source?.label?.trim() && input.source?.href?.trim()
      ? {
          label: input.source.label.trim(),
          href: input.source.href.trim(),
        }
      : undefined;

  return {
    id: existing?.id || path,
    path,
    type,
    slug,
    title,
    date:
      type !== "page" ? date : "",
    status:
      type !== "page" && input.status === "published" ? "published" : type === "page" ? "published" : "draft",
    publishedAt:
      type !== "page" ? String(input.publishedAt || existing?.publishedAt || "") : "",
    body: String(input.body || ""),
    source: type === "post" ? source : undefined,
    remoteSha: existing?.remoteSha || String(input.remoteSha || ""),
    publishedSource: existing?.publishedSource || String(input.publishedSource || ""),
    updatedAt: new Date().toISOString(),
    googleDocId: existing?.googleDocId || String(input.googleDocId || ""),
    driveRevision: existing?.driveRevision || String(input.driveRevision || ""),
    driveSyncedBody: existing?.driveSyncedBody || String(input.driveSyncedBody || ""),
  };
}

export function isDocumentDirty(document: WritingDocument) {
  return serializeWritingDocument(document).trim() !== document.publishedSource.trim();
}
