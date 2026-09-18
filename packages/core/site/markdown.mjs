const inlinePattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_/g;
const headingPattern = /^##\s+/;
const quotePattern = /^>\s?/;
const unorderedListPattern = /^\s*-\s+/;
const orderedListPattern = /^\s*\d+\.\s+/;
const imagePattern = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"((?:\\.|[^"\\])*)")?\)$/;
const escapableInlineCharacters = new Set(["\\", "*", "_", "[", "]", "(", ")"]);

/**
 * @typedef {{ type: "text" | "italic", value: string } | { type: "link", value: string, href: string }} InlineToken
 * @typedef {{ text: string, italic?: boolean, href?: string }} CaptionRun
 * @typedef {{ type: "heading" | "blockquote" | "paragraph", index: number, text: string } | { type: "image", index: number, alt: string, src: string, title?: string } | { type: "unordered-list", index: number, items: string[] } | { type: "ordered-list", index: number, items: string[], start: number }} ContentBlock
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

/** @param {string} value */
export function safeCaptionHref(value) {
  const href = value;
  const hasControl = [...href].some((character) => character.codePointAt(0) <= 31 || character.codePointAt(0) === 127);
  if (!href || hasControl || /[\s\\<>"']/.test(href)) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/")) return href.startsWith("//") ? null : href;
  if (!/^(?:https?:\/\/|mailto:)/i.test(href)) return null;
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:" ? href : null;
  } catch {
    return null;
  }
}

function decodeInlineHrefEscapes(value) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\" && escapableInlineCharacters.has(value[index + 1])) {
      decoded += value[index + 1];
      index += 1;
    } else {
      decoded += value[index];
    }
  }
  return decoded;
}

function findBalancedClose(value, start, open, close) {
  let depth = 1;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\" && escapableInlineCharacters.has(value[index + 1])) {
      index += 1;
      continue;
    }
    if (value[index] === open) depth += 1;
    if (value[index] === close && --depth === 0) return index;
  }
  return -1;
}

/**
 * Caption-only Markdown contract shared with Studio.
 * @param {string} value
 * @returns {CaptionRun[]}
 */
export function parseCaptionMarkdown(value) {
  /** @type {CaptionRun[]} */
  const runs = [];
  const append = (run) => {
    if (!run.text) return;
    const previous = runs.at(-1);
    if (previous && Boolean(previous.italic) === Boolean(run.italic) && previous.href === run.href) previous.text += run.text;
    else runs.push({ ...run });
  };
  const parse = (text, marks = {}, depth = 0) => {
    if (depth > 12) {
      append({ ...marks, text });
      return;
    }
    for (let index = 0; index < text.length;) {
      const character = text[index];
      if (character === "\\" && escapableInlineCharacters.has(text[index + 1])) {
        append({ ...marks, text: text[index + 1] });
        index += 2;
        continue;
      }
      if (character === "[" && !marks.href && text[index - 1] !== "!") {
        const labelEnd = findBalancedClose(text, index + 1, "[", "]");
        const hrefEnd = labelEnd > index && text[labelEnd + 1] === "(" ? findBalancedClose(text, labelEnd + 2, "(", ")") : -1;
        if (hrefEnd > labelEnd) {
          const href = safeCaptionHref(decodeInlineHrefEscapes(text.slice(labelEnd + 2, hrefEnd)));
          if (href) {
            parse(text.slice(index + 1, labelEnd), { ...marks, href }, depth + 1);
            index = hrefEnd + 1;
            continue;
          }
          append({ ...marks, text: text.slice(index, hrefEnd + 1) });
          index = hrefEnd + 1;
          continue;
        }
      }
      if ((character === "*" || character === "_") && !marks.italic && text[index - 1] !== character && text[index + 1] !== character && !/\s/.test(text[index + 1] || " ") && !(character === "_" && /[\p{L}\p{N}]/u.test(text[index - 1] || ""))) {
        let end = index + 1;
        for (; end < text.length; end += 1) {
          if (text[end] === "\\" && escapableInlineCharacters.has(text[end + 1])) {
            end += 1;
            continue;
          }
          if (text[end] === character && text[end - 1] !== character && text[end + 1] !== character && !/\s/.test(text[end - 1]) && !(character === "_" && /[\p{L}\p{N}]/u.test(text[end + 1] || ""))) break;
        }
        if (end < text.length) {
          parse(text.slice(index + 1, end), { ...marks, italic: true }, depth + 1);
          index = end + 1;
          continue;
        }
      }
      append({ ...marks, text: /[\r\n]/.test(character) ? " " : character });
      index += 1;
    }
  };
  parse(value);
  return runs;
}

/** @param {string} value */
function decodeImageTitle(value) {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\" && (value[index + 1] === "\\" || value[index + 1] === '"')) {
      decoded += value[index + 1];
      index += 1;
    } else {
      decoded += value[index];
    }
  }
  return decoded;
}

/** @param {string} src */
function isSafeImageSrc(src) {
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

/** @param {string} value */
export function parseImageMarkdown(value) {
  const match = value.match(imagePattern);
  if (!match || !isSafeImageSrc(match[2])) return null;
  return { alt: match[1], src: match[2], title: match[3] ? decodeImageTitle(match[3]) : undefined };
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
  const image = parseImageMarkdown(value);
  if (image) return image.alt;

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

    const image = parseImageMarkdown(paragraph);
    if (image) {
      blocks.push({ type: "image", index, ...image });
      index += 1;
      continue;
    }

    blocks.push({ type: "paragraph", index, text: paragraph });
    index += 1;
  }

  return blocks;
}
