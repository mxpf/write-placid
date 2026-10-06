import { isSafeImageSrc, parseCaptionMarkdown, parseContentBlocks, parseImageMarkdown, parseInlineMarkdown, stripInlineMarkdown } from "./markdown.mjs";
import { displayDate } from "./content.mjs";

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

function absoluteSiteUrl(value, siteUrl) {
  if (/^https:\/\//i.test(value)) return new URL(value).href;
  const base = new URL(siteUrl);
  const target = new URL(value.startsWith("/") ? value : `/${value}`, "https://write-placid.invalid");
  base.pathname = `${base.pathname.replace(/\/+$/, "")}${target.pathname}` || "/";
  base.search = target.search;
  base.hash = target.hash;
  return base.href;
}

function renderInlineHtml(value) {
  return parseInlineMarkdown(value).map((token) => token.type === "link"
    ? `<a href="${escapeXml(token.href)}">${renderInlineHtml(token.value)}</a>`
    : token.type === "italic" ? `<em>${renderInlineHtml(token.value)}</em>` : escapeXml(token.value)).join("");
}

function renderCaptionHtml(value) {
  const runs = parseCaptionMarkdown(value);
  let html = "";
  for (let index = 0; index < runs.length;) {
    const href = runs[index].href;
    let label = "";
    do {
      const run = runs[index++];
      const text = escapeXml(run.text);
      label += run.italic ? `<em>${text}</em>` : text;
    } while (href && index < runs.length && runs[index].href === href);
    html += href ? `<a href="${escapeXml(href)}" rel="noopener noreferrer">${label}</a>` : label;
  }
  return html;
}

function publicationDate(post) {
  const date = new Date(post.publishedAt || `${post.date}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid publication date for ${post.slug}.`);
  return date.toUTCString();
}

function renderListHtml(block) {
  const items = block.items.map((item) => {
    const children = (item.children || []).map(renderListHtml).join("");
    return `<li>${renderInlineHtml(item.text)}${children}</li>`;
  }).join("");
  return block.type === "unordered-list"
    ? `<ul>${items}</ul>`
    : `<ol${block.start === 1 ? "" : ` start="${block.start}"`}>${items}</ol>`;
}

function renderPostHtml(post, siteUrl) {
  const dek = post.dek?.replace(/\s+/g, " ").trim();
  const output = dek ? [`<p class="article-dek">${renderInlineHtml(dek)}</p>`] : [];
  output.push(...parseContentBlocks(post.paragraphs).map((block) => {
    if (block.type === "heading") return `<h2>${renderInlineHtml(block.text)}</h2>`;
    if (block.type === "blockquote") return `<blockquote><p>${renderInlineHtml(block.text)}</p></blockquote>`;
    if (block.type === "unordered-list" || block.type === "ordered-list") return renderListHtml(block);
    if (block.type === "image") {
      const src = block.src.startsWith("/") ? absoluteSiteUrl(block.src, siteUrl) : block.src;
      const caption = block.title ? `<figcaption>${renderCaptionHtml(block.title)}</figcaption>` : "";
      return `<figure><img src="${escapeXml(src)}" alt="${escapeXml(block.alt)}" loading="lazy" />${caption}</figure>`;
    }
    return `<p>${renderInlineHtml(block.text)}</p>`;
  }));
  if (post.source) output.push(`<p><a href="${escapeXml(post.source.href)}">${escapeXml(post.source.label)}</a></p>`);
  return output.join("\n");
}

export function generateRssFeed(posts, nowEntries = [], options) {
  const { siteName, siteUrl, description, rssPath = "/rss.xml", language = "en-us", feedId = new URL(siteUrl).hostname } = options;
  const entries = [...posts, ...nowEntries].sort((a, b) => (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date));
  const items = entries.map((post) => {
    const isNow = post.type === "now";
    const url = absoluteSiteUrl(isNow ? "/now" : `/${post.slug}`, siteUrl);
    const title = isNow ? `Now — ${displayDate(post.date)}` : post.title;
    const guid = isNow ? `${feedId}:now:${post.slug}` : url;
    const content = renderPostHtml(post, siteUrl).replaceAll("]]>", "]]]]><![CDATA[>");
    return `    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="${isNow ? "false" : "true"}">${escapeXml(guid)}</guid>\n      <pubDate>${publicationDate(post)}</pubDate>\n      <description>${escapeXml(contentDescription(post))}</description>\n      <content:encoded><![CDATA[${content}]]></content:encoded>\n    </item>`;
  }).join("\n");
  const lastBuildDate = entries.length ? publicationDate(entries[0]) : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n  <channel>\n    <title>${escapeXml(siteName)}</title>\n    <link>${absoluteSiteUrl("/", siteUrl)}</link>\n    <description>${escapeXml(description)}</description>\n    <language>${escapeXml(language)}</language>\n    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n    <atom:link href="${escapeXml(absoluteSiteUrl(rssPath, siteUrl))}" rel="self" type="application/rss+xml" />\n${items}\n  </channel>\n</rss>\n`;
}

export function generateSitemap(posts, pages, { siteUrl, nowPath = "/now" }) {
  const paths = ["/", nowPath, ...pages.map(({ slug }) => `/${slug}`), ...posts.map(({ slug }) => `/${slug}`)];
  const urls = paths.map((pathname) => `  <url><loc>${escapeXml(absoluteSiteUrl(pathname, siteUrl))}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Select the first image accepted by the shared Markdown image contract. */
export function firstSafeArticleImage(paragraphs) {
  for (const paragraph of paragraphs) {
    const image = parseImageMarkdown(paragraph);
    if (image) return image;
  }
  return null;
}

/** Use an authored dek as the summary, with the first body paragraph as fallback. */
export function contentDescription(document) {
  return stripInlineMarkdown(document.dek?.trim() || document.paragraphs?.[0] || "").replace(/\s+/g, " ").trim();
}

/**
 * Build portable Open Graph and Twitter metadata from publication content and
 * installation-owned identity/configuration.
 */
export function buildSocialMetadata(document, { siteName, siteUrl, fallbackImage, pathname = `/${document.slug}` }) {
  const articleImage = firstSafeArticleImage(document.paragraphs || []);
  const selectedImage = articleImage || { src: fallbackImage, alt: `${siteName} social card` };
  if (!isSafeImageSrc(selectedImage.src)) throw new Error("The social fallback image must use an HTTPS or root-relative URL.");
  const image = { url: absoluteSiteUrl(selectedImage.src, siteUrl), alt: selectedImage.alt };
  const description = contentDescription(document);
  const canonicalUrl = absoluteSiteUrl(pathname, siteUrl);
  return {
    openGraph: { title: document.title, description, siteName, url: canonicalUrl, images: [image] },
    twitter: { card: "summary_large_image", title: document.title, description, images: [image] },
  };
}

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function redirectDocument(target, { siteName = "Write Placid" } = {}) {
  const escapedHref = escapeHtml(target);
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="robots" content="noindex">\n  <link rel="canonical" href="${escapedHref}">\n  <meta http-equiv="refresh" content="0; url=${escapedHref}">\n  <title>Moved · ${escapeHtml(siteName)}</title>\n</head>\n<body>\n  <p>This page moved to <a href="${escapedHref}">${escapedHref}</a>.</p>\n  <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>\n</body>\n</html>\n`;
}
