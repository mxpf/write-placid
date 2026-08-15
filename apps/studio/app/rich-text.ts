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
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const html: string[] = [];

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
    if (/^-\s+/.test(blocks[index])) {
      const items: string[] = [];
      while (index < blocks.length && /^-\s+/.test(blocks[index])) {
        items.push(`<li>${renderInlineMarkdown(blocks[index].replace(/^-\s+/, ""))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    html.push(`<p>${renderInlineMarkdown(blocks[index])}</p>`);
    index += 1;
  }

  return html.join("");
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
    case "li":
      return children.trim() ? `- ${children.trim()}\n\n` : "";
    case "ul":
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
