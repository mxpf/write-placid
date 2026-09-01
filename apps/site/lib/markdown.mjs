const inlinePattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_/g;
const headingPattern = /^##\s+/;
const quotePattern = /^>\s?/;
const unorderedListPattern = /^\s*-\s+/;
const orderedListPattern = /^\s*\d+\.\s+/;

/**
 * @typedef {{ type: "text" | "italic", value: string } | { type: "link", value: string, href: string }} InlineToken
 * @typedef {{ type: "heading" | "blockquote" | "paragraph", index: number, text: string } | { type: "unordered-list", index: number, items: string[] } | { type: "ordered-list", index: number, items: string[], start: number }} ContentBlock
 */

/** @param {string} href */
function isSafeInlineHref(href) {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

/**
 * @param {string} value
 * @returns {InlineToken[]}
 */
export function parseInlineMarkdown(value) {
  /** @type {InlineToken[]} */
  const tokens = [];
  let cursor = 0;

  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ type: "text", value: value.slice(cursor, index) });

    if (match[1] && match[2] && isSafeInlineHref(match[2])) {
      tokens.push({ type: "link", value: match[1], href: match[2] });
    } else if (match[3] || match[4]) {
      tokens.push({ type: "italic", value: match[3] || match[4] });
    } else {
      tokens.push({ type: "text", value: match[0] });
    }
    cursor = index + match[0].length;
  }

  if (cursor < value.length) tokens.push({ type: "text", value: value.slice(cursor) });
  return tokens;
}

/** @param {string} value */
export function stripInlineMarkdown(value) {
  return parseInlineMarkdown(value)
    .map((token) => token.type === "text" ? token.value : stripInlineMarkdown(token.value))
    .join("");
}

/**
 * @param {readonly string[]} paragraphs
 * @returns {ContentBlock[]}
 */
export function parseContentBlocks(paragraphs) {
  /** @type {ContentBlock[]} */
  const blocks = [];

  for (let index = 0; index < paragraphs.length;) {
    const paragraph = paragraphs[index];

    if (headingPattern.test(paragraph)) {
      blocks.push({ type: "heading", index, text: paragraph.replace(headingPattern, "") });
      index += 1;
      continue;
    }

    if (quotePattern.test(paragraph)) {
      blocks.push({ type: "blockquote", index, text: paragraph.replace(/^>\s?/gm, "") });
      index += 1;
      continue;
    }

    if (unorderedListPattern.test(paragraph)) {
      const listIndex = index;
      const items = [];
      while (index < paragraphs.length && unorderedListPattern.test(paragraphs[index])) {
        items.push(paragraphs[index].replace(unorderedListPattern, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", index: listIndex, items });
      continue;
    }

    if (orderedListPattern.test(paragraph)) {
      const listIndex = index;
      const start = Number(paragraph.match(/^\s*(\d+)\./)?.[1] || 1);
      const items = [];
      while (index < paragraphs.length && orderedListPattern.test(paragraphs[index])) {
        items.push(paragraphs[index].replace(orderedListPattern, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", index: listIndex, start, items });
      continue;
    }

    blocks.push({ type: "paragraph", index, text: paragraph });
    index += 1;
  }

  return blocks;
}
