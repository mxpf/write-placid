export type InlineToken =
  | { type: "text"; value: string }
  | { type: "italic"; value: string }
  | { type: "link"; value: string; href: string };

const inlinePattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_/g;

function isSafeInlineHref(href: string) {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

export function parseInlineMarkdown(value: string): InlineToken[] {
  const tokens: InlineToken[] = [];
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

export function stripInlineMarkdown(value: string): string {
  return parseInlineMarkdown(value)
    .map((token) => token.type === "text" ? token.value : stripInlineMarkdown(token.value))
    .join("");
}
