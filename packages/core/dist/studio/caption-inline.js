const escapable = /[\\*_[\]()]/;
export function safeCaptionHref(value) {
    const href = value;
    if (!href || /[\s\\<>"']/u.test(href) || Array.from(href).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
        return null;
    if (href.startsWith("#"))
        return href;
    if (href.startsWith("/"))
        return href.startsWith("//") ? null : href;
    if (!/^(?:https?:\/\/|mailto:)/i.test(href))
        return null;
    try {
        const url = new URL(href);
        return ["https:", "http:", "mailto:"].includes(url.protocol) ? href : null;
    }
    catch {
        return null;
    }
}
export function escapeCaptionText(value) {
    return value.replace(/[\\*_[\]()]/g, "\\$&").replace(/[\r\n]+/g, " ");
}
function append(runs, run) {
    if (!run.text)
        return;
    const previous = runs.at(-1);
    if (previous && Boolean(previous.italic) === Boolean(run.italic) && previous.href === run.href)
        previous.text += run.text;
    else
        runs.push({ ...run });
}
function closing(value, start, open, close) {
    let depth = 1;
    for (let i = start; i < value.length; i++) {
        if (value[i] === "\\" && escapable.test(value[i + 1] || "")) {
            i++;
            continue;
        }
        if (value[i] === open)
            depth++;
        if (value[i] === close && --depth === 0)
            return i;
    }
    return -1;
}
export function parseCaption(value) {
    const runs = [];
    const parse = (text, marks = {}, depth = 0) => {
        if (depth > 12) {
            append(runs, { ...marks, text });
            return;
        }
        for (let i = 0; i < text.length;) {
            const char = text[i];
            if (char === "\\" && escapable.test(text[i + 1] || "")) {
                append(runs, { ...marks, text: text[i + 1] });
                i += 2;
                continue;
            }
            if (char === "[" && !marks.href && text[i - 1] !== "!") {
                const labelEnd = closing(text, i + 1, "[", "]");
                const hrefEnd = labelEnd > i && text[labelEnd + 1] === "(" ? closing(text, labelEnd + 2, "(", ")") : -1;
                if (hrefEnd > labelEnd) {
                    const href = safeCaptionHref(text.slice(labelEnd + 2, hrefEnd).replace(/\\([\\*_[\]()])/g, "$1"));
                    if (href) {
                        parse(text.slice(i + 1, labelEnd), { ...marks, href }, depth + 1);
                        i = hrefEnd + 1;
                        continue;
                    }
                    // Unsupported destinations remain visible, inert Markdown.
                    append(runs, { ...marks, text: text.slice(i, hrefEnd + 1) });
                    i = hrefEnd + 1;
                    continue;
                }
            }
            if ((char === "*" || char === "_") && !marks.italic && text[i - 1] !== char && text[i + 1] !== char && !/\s/.test(text[i + 1] || " ") && !(char === "_" && /[\p{L}\p{N}]/u.test(text[i - 1] || ""))) {
                let end = i + 1;
                for (; end < text.length; end++) {
                    if (text[end] === "\\" && escapable.test(text[end + 1] || "")) {
                        end++;
                        continue;
                    }
                    if (text[end] === char && text[end - 1] !== char && text[end + 1] !== char && !/\s/.test(text[end - 1]) && !(char === "_" && /[\p{L}\p{N}]/u.test(text[end + 1] || "")))
                        break;
                }
                if (end < text.length) {
                    parse(text.slice(i + 1, end), { ...marks, italic: true }, depth + 1);
                    i = end + 1;
                    continue;
                }
            }
            append(runs, { ...marks, text: /[\r\n]/.test(char) ? " " : char });
            i++;
        }
    };
    parse(value);
    return runs;
}
function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function captionToHtml(value) {
    const runs = parseCaption(value);
    let html = "";
    for (let i = 0; i < runs.length;) {
        const href = runs[i].href;
        let label = "";
        do {
            const run = runs[i++];
            const text = escapeHtml(run.text);
            label += run.italic ? `<em>${text}</em>` : text;
        } while (i < runs.length && runs[i].href === href);
        html += href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${label}</a>` : label;
    }
    return html;
}
export function captionToText(value) { return parseCaption(value).map(run => run.text).join(""); }
export function captionRunsToMarkdown(input) {
    const runs = [];
    for (const run of input)
        append(runs, { ...run, text: run.text.replace(/[\r\n]+/g, " "), href: safeCaptionHref(run.href || "") || undefined });
    let result = "";
    for (let i = 0; i < runs.length;) {
        const href = runs[i].href;
        let label = "";
        do {
            const run = runs[i++];
            const text = escapeCaptionText(run.text);
            label += run.italic ? text.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, before, inner, after) => `${before}${inner ? `*${inner}*` : ""}${after}`) : text;
        } while (i < runs.length && runs[i].href === href);
        result += href ? `[${label}](${href.replace(/[\\()]/g, "\\$&")})` : label;
    }
    return result;
}
/** Read only allowed formatting from an inert pasted DOM or the caption editor. */
export function captionDomToMarkdown(root) {
    const runs = [];
    const visit = (node, marks = {}) => {
        if (node.nodeType === 3) {
            append(runs, { ...marks, text: node.nodeValue || "" });
            return;
        }
        if (node.nodeType !== 1)
            return;
        const element = node;
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|TEMPLATE|IMG|VIDEO|AUDIO)$/.test(element.tagName))
            return;
        if (element.tagName === "BR") {
            append(runs, { ...marks, text: " " });
            return;
        }
        const next = { ...marks };
        if (element.tagName === "EM" || element.tagName === "I" || element.style?.fontStyle === "italic")
            next.italic = true;
        if (element.tagName === "A")
            next.href = safeCaptionHref(element.getAttribute("href") || "") || undefined;
        if (/^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(element.tagName) && runs.length && !/\s$/.test(runs.at(-1).text))
            append(runs, { text: " " });
        for (const child of Array.from(element.childNodes))
            visit(child, next);
        if (/^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(element.tagName))
            append(runs, { text: " " });
    };
    for (const child of Array.from(root.childNodes))
        visit(child);
    return captionRunsToMarkdown(runs).trim();
}
//# sourceMappingURL=caption-inline.js.map