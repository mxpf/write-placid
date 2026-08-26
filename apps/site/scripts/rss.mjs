import { writeFile } from "node:fs/promises";
import path from "node:path";
import { displayDate, projectRoot } from "./content.mjs";
import siteConfig from "../site.config.json" with { type: "json" };

const siteUrl = siteConfig.url;
const feedUrl = `${siteUrl}/rss.xml`;
const inlinePattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_/g;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isSafeHref(href) {
  try {
    const protocol = new URL(href, siteUrl).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

function renderInlineHtml(value) {
  let output = "";
  let cursor = 0;

  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    output += escapeXml(value.slice(cursor, index));

    if (match[1] && match[2] && isSafeHref(match[2])) {
      output += `<a href="${escapeXml(match[2])}">${renderInlineHtml(match[1])}</a>`;
    } else if (match[3] || match[4]) {
      output += `<em>${renderInlineHtml(match[3] || match[4])}</em>`;
    } else {
      output += escapeXml(match[0]);
    }
    cursor = index + match[0].length;
  }

  return output + escapeXml(value.slice(cursor));
}

function stripInlineMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]/g, "");
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
  const paragraphs = [];
  for (let index = 0; index < post.paragraphs.length;) {
    if (/^##\s+/.test(post.paragraphs[index])) {
      paragraphs.push(`<h2>${renderInlineHtml(post.paragraphs[index].replace(/^##\s+/, ""))}</h2>`);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(post.paragraphs[index])) {
      const quote = post.paragraphs[index].replace(/^>\s?/gm, "");
      paragraphs.push(`<blockquote><p>${renderInlineHtml(quote)}</p></blockquote>`);
      index += 1;
      continue;
    }
    if (/^\s*-\s+/.test(post.paragraphs[index])) {
      const items = [];
      while (index < post.paragraphs.length && /^\s*-\s+/.test(post.paragraphs[index])) {
        items.push(`<li>${renderInlineHtml(post.paragraphs[index].replace(/^\s*-\s+/, ""))}</li>`);
        index += 1;
      }
      paragraphs.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(post.paragraphs[index])) {
      const start = Number(post.paragraphs[index].match(/^\s*(\d+)\./)?.[1] || 1);
      const items = [];
      while (index < post.paragraphs.length && /^\s*\d+\.\s+/.test(post.paragraphs[index])) {
        items.push(`<li>${renderInlineHtml(post.paragraphs[index].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        index += 1;
      }
      const startAttribute = start === 1 ? "" : ` start="${start}"`;
      paragraphs.push(`<ol${startAttribute}>${items.join("")}</ol>`);
      continue;
    }
    paragraphs.push(`<p>${renderInlineHtml(post.paragraphs[index])}</p>`);
    index += 1;
  }
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
    const url = isNow ? `${siteUrl}/now` : `${siteUrl}/${post.slug}`;
    const title = isNow ? `Now — ${displayDate(post.date)}` : post.title;
    const guid = isNow
      ? `<guid isPermaLink="false">${escapeXml(siteConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}:now:${escapeXml(post.slug)}</guid>`
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
    <title>${escapeXml(siteConfig.name)}</title>
    <link>${siteUrl}/</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>${escapeXml(siteConfig.language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export async function writeRssFeed(posts, nowEntries = []) {
  await writeFile(
    path.join(projectRoot, "public", "rss.xml"),
    generateRssFeed(posts, nowEntries),
    "utf8",
  );
}
