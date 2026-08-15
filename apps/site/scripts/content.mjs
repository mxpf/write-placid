import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..");
const postsDirectory = path.join(projectRoot, "content", "posts");
const pagesDirectory = path.join(projectRoot, "content", "pages");
const nowDirectory = path.join(projectRoot, "content", "now");

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseFrontmatter(source) {
  const match = source.replace(/\r\n/g, "\n").match(frontmatterPattern);
  if (!match) throw new Error("Post is missing frontmatter.");

  const metadata = {};
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

function quote(value) {
  return JSON.stringify(value ?? "");
}

export function calculateReadingTime(body) {
  const readableBody = body
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
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function parsePost(source, filename = "") {
  const { metadata, body } = parseFrontmatter(source);
  const slug = metadata.slug || filename.replace(/\.md$/, "");
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return {
    type: "post",
    title: metadata.title || "Untitled",
    slug,
    date: metadata.date || new Date().toISOString().slice(0, 10),
    publishedAt: metadata.publishedAt || "",
    status: metadata.status === "draft" ? "draft" : "published",
    body,
    paragraphs,
    readingTime: calculateReadingTime(body),
    source:
      metadata.sourceLabel && metadata.sourceHref
        ? { label: metadata.sourceLabel, href: metadata.sourceHref }
        : undefined,
  };
}

function parseNowEntry(source, filename = "") {
  return { ...parsePost(source, filename), type: "now", title: "Now" };
}

function parsePage(source, filename = "") {
  const { metadata, body } = parseFrontmatter(source);
  const slug = metadata.slug || filename.replace(/\.md$/, "");
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return {
    type: "page",
    title: metadata.title || "Untitled",
    slug,
    body,
    paragraphs,
  };
}

export function serializePost(post) {
  const metadata = [
    "---",
    `title: ${quote(post.title)}`,
    `slug: ${post.slug}`,
    `date: ${post.date}`,
    `status: ${post.status === "published" ? "published" : "draft"}`,
  ];

  if (post.publishedAt) metadata.push(`publishedAt: ${post.publishedAt}`);

  if (post.source?.label && post.source?.href) {
    metadata.push(`sourceLabel: ${quote(post.source.label)}`);
    metadata.push(`sourceHref: ${quote(post.source.href)}`);
  }

  metadata.push("---", "", post.body.trim(), "");
  return metadata.join("\n");
}

export async function readPosts({ includeDrafts = false } = {}) {
  const files = (await readdir(postsDirectory))
    .filter((file) => file.endsWith(".md"))
    .sort();

  const posts = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(postsDirectory, file), "utf8");
      return parsePost(source, file);
    }),
  );

  return posts
    .filter((post) => includeDrafts || post.status === "published")
    .sort((a, b) =>
      (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date),
    );
}

export async function readNowEntries({ includeDrafts = false } = {}) {
  let files = [];
  try {
    files = (await readdir(nowDirectory))
      .filter((file) => file.endsWith(".md"))
      .sort();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const entries = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(nowDirectory, file), "utf8");
      return parseNowEntry(source, file);
    }),
  );

  return entries
    .filter((entry) => includeDrafts || entry.status === "published")
    .sort((a, b) =>
      (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date),
    );
}

export async function readPages() {
  const files = (await readdir(pagesDirectory))
    .filter((file) => file.endsWith(".md"))
    .sort();

  return Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(pagesDirectory, file), "utf8");
      return parsePage(source, file);
    }),
  );
}
