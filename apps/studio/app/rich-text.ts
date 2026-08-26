function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmphasis(value: string) {
  return value.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function renderInlineMarkdown(value: string) {
  const links: string[] = [];
  const protectLink = (label: string, href: string) => {
    const token = `\uE000${links.length}\uE001`;
    links.push(
      `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${renderEmphasis(escapeHtml(label))}</a>`,
    );
    return token;
  };
  const protectedLegacyLinks = value.replace(
    /([“"][^”"\n]+[”"])\s+\((https?:\/\/[^)\s]+)\)/g,
    (_, label: string, href: string) => protectLink(label, href),
  );
  const protectedLinks = protectedLegacyLinks.replace(
    /\[([^\]]+)]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|\/[^)\s]*|#[^)\s]*)\)/g,
    (_, label: string, href: string) => protectLink(label, href),
  );

  return renderEmphasis(escapeHtml(protectedLinks))
    .replace(/\uE000(\d+)\uE001/g, (_, index: string) => links[Number(index)] ?? "")
    .replace(/\n/g, "<br>");
}

export function markdownToEditorHtml(markdown: string) {
  if (!markdown.trim()) return "";
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!/^(?:[-+*]|\d+\.)\s+/.test(lines[0] || "")) {
        return [block.trim()];
      }

      const items: string[] = [];
      for (const line of lines) {
        if (/^(?:[-+*]|\d+\.)\s+/.test(line)) {
          items.push(line);
        } else if (items.length) {
          items[items.length - 1] += ` ${line}`;
        }
      }
      return items;
    })
    .filter(Boolean);
  const html: string[] = [];
  const listItemPattern = /^[-+*]\s+/;
  const numberedItemPattern = /^(\d+)\.\s+/;

  for (let index = 0; index < blocks.length;) {
    if (/^##\s+/.test(blocks[index])) {
      html.push(`<h2>${renderInlineMarkdown(blocks[index].replace(/^##\s+/, ""))}</h2>`);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(blocks[index])) {
      const quote = blocks[index].replace(/^>\s?/gm, "");
      html.push(`<blockquote>${renderInlineMarkdown(quote)}</blockquote>`);
      index += 1;
      continue;
    }
    if (listItemPattern.test(blocks[index])) {
      const items: string[] = [];
      while (index < blocks.length) {
        const lines = blocks[index].split("\n");
        if (!lines.every((line) => listItemPattern.test(line))) break;
        items.push(
          ...lines.map(
            (line) => `<li>${renderInlineMarkdown(line.replace(listItemPattern, ""))}</li>`,
          ),
        );
        index += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (numberedItemPattern.test(blocks[index])) {
      const start = Number(blocks[index].match(numberedItemPattern)?.[1] || 1);
      const items: string[] = [];
      while (index < blocks.length && numberedItemPattern.test(blocks[index])) {
        items.push(
          `<li>${renderInlineMarkdown(blocks[index].replace(numberedItemPattern, ""))}</li>`,
        );
        index += 1;
      }
      const startAttribute = start === 1 ? "" : ` start="${start}"`;
      html.push(`<ol${startAttribute}>${items.join("")}</ol>`);
      continue;
    }
    html.push(`<p>${renderInlineMarkdown(blocks[index])}</p>`);
    index += 1;
  }

  return html.join("");
}

export function markdownPasteToEditorHtml(value: string) {
  const hasBlockFormatting = /(^|\n)\s*(?:##\s+|>\s?|[-+*]\s+|\d+\.\s+)/m.test(value);
  const hasItalic = /(^|[^*])\*[^*\n]+\*(?!\*)/.test(value);
  const hasLink = /\[[^\]\n]+]\((?:https?:\/\/|mailto:|\/|#)[^)\s]+\)/.test(value);

  if (!hasBlockFormatting && !hasItalic && !hasLink) return null;
  return markdownToEditorHtml(value);
}

export function numberedListShortcutStart(value: string) {
  const match = value.match(/^(\d+)\.$/);
  return match ? Number(match[1]) : null;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue || "").replace(/\u00a0/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const children = Array.from(element.childNodes).map(nodeToMarkdown).join("");
  switch (element.tagName.toLowerCase()) {
    case "br":
      return "\n";
    case "em":
    case "i":
      return children ? `*${children}*` : "";
    case "a": {
      const href = element.getAttribute("href") || "";
      return children && href ? `[${children}](${href})` : children;
    }
    case "li": {
      const parent = element.parentElement;
      if (parent?.tagName.toLowerCase() === "ol") {
        const start = Number(parent.getAttribute("start") || 1);
        const index = Array.from(parent.children).indexOf(element);
        return children.trim() ? `${start + Math.max(index, 0)}. ${children.trim()}\n\n` : "";
      }
      return children.trim() ? `- ${children.trim()}\n\n` : "";
    }
    case "ul":
    case "ol":
      return children;
    case "h2":
      return children.trim() ? `## ${children.trim()}\n\n` : "";
    case "blockquote": {
      const quote = children.trim();
      return quote
        ? `${quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`
        : "";
    }
    case "p":
    case "div":
      return `${children}\n\n`;
    default:
      return children;
  }
}

export function editorToMarkdown(editor: HTMLElement) {
  return Array.from(editor.childNodes)
    .map(nodeToMarkdown)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
