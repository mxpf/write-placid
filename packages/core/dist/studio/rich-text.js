import { captionToHtml, captionToText } from "./caption-inline.js";
import { articleImageMarkdown, parseArticleImage } from "./article-images.js";
import { parseContentBlocks } from "@mxpf/write-placid-core/markdown";
export function readEditorImage(figure) {
    const image = figure.querySelector("img");
    const src = figure.dataset.imageSrc || image?.getAttribute("src");
    if (!image || !src)
        return null;
    return {
        src,
        alt: image.getAttribute("alt") || "",
        title: figure.dataset.imageTitle || image.getAttribute("title") || undefined,
    };
}
/** Change image text in place so its source, surrounding writing and selection survive. */
export function updateEditorImage(figure, details) {
    const image = figure.querySelector("img");
    if (!image)
        return false;
    image.setAttribute("alt", details.alt);
    figure.setAttribute("aria-label", `Edit image: ${details.alt}`);
    let caption = figure.querySelector("figcaption");
    if (details.title) {
        image.setAttribute("title", captionToText(details.title));
        figure.dataset.imageTitle = details.title;
        if (!caption) {
            caption = figure.ownerDocument.createElement("figcaption");
            figure.appendChild(caption);
        }
        caption.innerHTML = captionToHtml(details.title);
    }
    else {
        image.removeAttribute("title");
        delete figure.dataset.imageTitle;
        caption?.remove();
    }
    return true;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function renderEmphasis(value) {
    return value.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}
function renderInlineMarkdown(value) {
    const links = [];
    const protectLink = (label, href) => {
        const token = `\uE000${links.length}\uE001`;
        links.push(`<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${renderEmphasis(escapeHtml(label))}</a>`);
        return token;
    };
    const protectedLegacyLinks = value.replace(/([“"][^”"\n]+[”"])\s+\((https?:\/\/[^)\s]+)\)/g, (_, label, href) => protectLink(label, href));
    const protectedLinks = protectedLegacyLinks.replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|doc:[^)\s]+|\/[^)\s]*|#[^)\s]*)\)/g, (_, label, href) => protectLink(label, href));
    return renderEmphasis(escapeHtml(protectedLinks))
        .replace(/\uE000(\d+)\uE001/g, (_, index) => links[Number(index)] ?? "")
        .replace(/\n/g, "<br>");
}
function renderEditorList(block) {
    const items = block.items.map((item) => {
        const children = item.children?.map(renderEditorList).join("") || "";
        return `<li>${renderInlineMarkdown(item.text)}${children}</li>`;
    }).join("");
    const start = block.type === "ordered-list" && block.start !== 1 ? ` start="${block.start}"` : "";
    const tag = block.type === "ordered-list" ? "ol" : "ul";
    return `<${tag}${start}>${items}</${tag}>`;
}
export function markdownToEditorHtml(markdown) {
    if (!markdown.trim())
        return "";
    const blocks = markdown
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .flatMap((block) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (!/^\s*(?:[-+*]|\d+\.)\s+/.test(lines[0] || "")) {
            return [block.trim()];
        }
        const items = [];
        for (const line of lines) {
            if (/^\s*(?:[-+*]|\d+\.)\s+/.test(line)) {
                items.push(line.trimEnd().replace(/^(\s*)[+*]\s+/, "$1- "));
            }
            else if (items.length) {
                items[items.length - 1] += ` ${line.trim()}`;
            }
        }
        return items;
    })
        .filter(Boolean);
    const html = [];
    const listItemPattern = /^\s*-\s+/;
    const numberedItemPattern = /^\s*(\d+)\.\s+/;
    for (let index = 0; index < blocks.length;) {
        const image = parseArticleImage(blocks[index]);
        if (image) {
            const previewSrc = image.src.startsWith("/images/")
                ? `/api/content/image?name=${encodeURIComponent(image.src.slice("/images/".length))}`
                : image.src;
            const titleAttribute = image.title ? ` title="${escapeHtml(captionToText(image.title))}"` : "";
            const dataTitle = image.title ? ` data-image-title="${escapeHtml(image.title)}"` : "";
            const caption = image.title ? `<figcaption>${captionToHtml(image.title)}</figcaption>` : "";
            html.push(`<div class="editor-image-block" contenteditable="false"><figure class="article-image" data-image-src="${escapeHtml(image.src)}"${dataTitle} contenteditable="false" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${escapeHtml(`Edit image: ${image.alt}`)}"><img src="${escapeHtml(previewSrc)}" alt="${escapeHtml(image.alt)}"${titleAttribute}>${caption}</figure><button type="button" class="edit-image-control" data-editor-image-control="true" aria-haspopup="dialog">Edit image &amp; caption</button></div>`);
            index += 1;
            continue;
        }
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
        if (listItemPattern.test(blocks[index]) || numberedItemPattern.test(blocks[index])) {
            const listParagraphs = [];
            while (index < blocks.length && (listItemPattern.test(blocks[index]) || numberedItemPattern.test(blocks[index]))) {
                listParagraphs.push(blocks[index]);
                index += 1;
            }
            html.push(...parseContentBlocks(listParagraphs).map((block) => renderEditorList(block)));
            continue;
        }
        html.push(`<p>${renderInlineMarkdown(blocks[index])}</p>`);
        index += 1;
    }
    return html.join("");
}
export function markdownPasteToEditorHtml(value) {
    const hasBlockFormatting = /(^|\n)\s*(?:##\s+|>\s?|[-+*]\s+|\d+\.\s+|!\[[^\]]*]\([^)]+\))/m.test(value);
    const hasItalic = /(^|[^*])\*[^*\n]+\*(?!\*)/.test(value);
    const hasLink = /\[[^\]\n]+]\((?:https?:\/\/|mailto:|doc:|\/|#)[^)\s]+\)/.test(value);
    if (!hasBlockFormatting && !hasItalic && !hasLink)
        return null;
    return markdownToEditorHtml(value);
}
export function numberedListShortcutStart(value) {
    const match = value.match(/^(\d+)\.$/);
    return match ? Number(match[1]) : null;
}
function listToMarkdown(list, depth = 0) {
    const ordered = list.tagName.toLowerCase() === "ol";
    const start = ordered ? Number(list.getAttribute("start") || 1) : 1;
    return Array.from(list.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child, index) => {
        const item = child;
        const text = Array.from(item.childNodes)
            .filter((childNode) => !(childNode.nodeType === Node.ELEMENT_NODE && ["ul", "ol"].includes(childNode.tagName.toLowerCase())))
            .map(nodeToMarkdown)
            .join("")
            .trim();
        const marker = ordered ? `${start + index}.` : "-";
        const nested = Array.from(item.children)
            .filter((nestedList) => ["ul", "ol"].includes(nestedList.tagName.toLowerCase()))
            .map((nestedList) => listToMarkdown(nestedList, depth + 1))
            .join("\n");
        return `${"  ".repeat(depth)}${marker} ${text}${nested ? `\n${nested}` : ""}`;
    })
        .join(depth === 0 ? "\n\n" : "\n");
}
function nodeToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node.nodeValue || "").replace(/\u00a0/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE)
        return "";
    const element = node;
    if (element.dataset?.editorImageControl !== undefined)
        return "";
    const tagName = element.tagName.toLowerCase();
    if (tagName === "ul" || tagName === "ol")
        return `${listToMarkdown(element)}\n\n`;
    const children = Array.from(element.childNodes).map(nodeToMarkdown).join("");
    switch (tagName) {
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
            return children;
        case "h2":
            return children.trim() ? `## ${children.trim()}\n\n` : "";
        case "blockquote": {
            const quote = children.trim();
            return quote
                ? `${quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`
                : "";
        }
        case "figure": {
            const image = readEditorImage(element);
            return image ? `${articleImageMarkdown(image)}\n\n` : "";
        }
        case "p":
        case "div":
            return `${children}\n\n`;
        default:
            return children;
    }
}
export function editorToMarkdown(editor) {
    return Array.from(editor.childNodes)
        .map(nodeToMarkdown)
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
//# sourceMappingURL=rich-text.js.map