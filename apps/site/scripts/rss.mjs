import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseContentBlocks, parseInlineMarkdown, stripInlineMarkdown } from "../lib/markdown.mjs";
import { FEED_URL, RSS_GUID_PREFIX, RSS_PATH, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_NAME, SITE_URL } from "../site-config.mjs";
import { displayDate, projectRoot } from "./content.mjs";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderInlineHtml(value) {
  return parseInlineMarkdown(value).map((token) => {
    if (token.type === "link") {
      return `<a href="${escapeXml(token.href)}">${renderInlineHtml(token.value)}</a>`;
    }
    if (token.type === "italic") return `<em>${renderInlineHtml(token.value)}</em>`;
    return escapeXml(token.value);
  }).join("");
}

function publicationDate(post) {
  const date = new Date(post.publishedAt || `${post.date}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid publication date for ${post.slug}.`);
  return date.toUTCString();
}

function cdata(value) {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

function renderPostHtml(post) {
  const paragraphs = parseContentBlocks(post.paragraphs).map((block) => {
    if (block.type === "heading") return `<h2>${renderInlineHtml(block.text)}</h2>`;
    if (block.type === "blockquote") {
      return `<blockquote><p>${renderInlineHtml(block.text)}</p></blockquote>`;
    }
    if (block.type === "unordered-list" || block.type === "ordered-list") {
      const items = block.items
        .map((item) => `<li>${renderInlineHtml(item)}</li>`)
        .join("");
      if (block.type === "unordered-list") return `<ul>${items}</ul>`;
      const startAttribute = block.start === 1 ? "" : ` start="${block.start}"`;
      return `<ol${startAttribute}>${items}</ol>`;
    }
    return `<p>${renderInlineHtml(block.text)}</p>`;
  });
  if (post.source) {
    paragraphs.push(
      `<p><a href="${escapeXml(post.source.href)}">${escapeXml(post.source.label)}</a></p>`,
    );
  }
  return paragraphs.join("\n");
}

export function generateRssFeed(posts, nowEntries = []) {
  const entries = [...posts, ...nowEntries]
    .sort((a, b) =>
      (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date),
    );
  const items = entries.map((post) => {
    const isNow = post.type === "now";
    const url = isNow ? `${SITE_URL}/now` : `${SITE_URL}/${post.slug}`;
    const title = isNow ? `Now — ${displayDate(post.date)}` : post.title;
    const guid = isNow
      ? `<guid isPermaLink="false">${escapeXml(RSS_GUID_PREFIX)}:now:${escapeXml(post.slug)}</guid>`
      : `<guid isPermaLink="true">${url}</guid>`;
    const description = stripInlineMarkdown(post.paragraphs[0] || "");
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${url}</link>
      ${guid}
      <pubDate>${publicationDate(post)}</pubDate>
      <description>${escapeXml(description)}</description>
      <content:encoded><![CDATA[${cdata(renderPostHtml(post))}]]></content:encoded>
    </item>`;
  }).join("\n");

  const lastBuildDate = entries.length
    ? publicationDate(entries[0])
    : new Date("1970-01-01T00:00:00.000Z").toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}/</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>${escapeXml(SITE_LANGUAGE)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export async function writeRssFeed(posts, nowEntries = []) {
  await writeFile(
    path.join(projectRoot, "public", path.basename(RSS_PATH)),
    generateRssFeed(posts, nowEntries),
    "utf8",
  );
}
