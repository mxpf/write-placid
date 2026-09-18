const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
function parseFrontmatter(source) {
    const match = source.replace(/\r\n/g, "\n").match(frontmatterPattern);
    if (!match)
        throw new Error("This document is missing its frontmatter.");
    const metadata = {};
    for (const line of match[1].split("\n")) {
        const separator = line.indexOf(":");
        if (!line.trim() || line.trimStart().startsWith("#"))
            continue;
        if (separator === -1 || /^\s/.test(line))
            throw new Error("Frontmatter must use one field per line; preserve and convert this file before editing.");
        const key = line.slice(0, separator).trim();
        if (Object.hasOwn(metadata, key))
            throw new Error(`Duplicate frontmatter field: ${key}`);
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
        }
        metadata[key] = value;
    }
    return { metadata, body: match[2].trim() };
}
function quote(value) {
    return JSON.stringify(value ?? "");
}
function slugify(value) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}
export function calculateReadingTime(body) {
    const readableBody = body
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_]/g, "");
    const words = readableBody.trim().match(/[\p{L}\p{N}’'-]+/gu)?.length ?? 0;
    const minutes = Math.max(1, Math.ceil(words / 180));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
export function displayDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day)
        return value;
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
}
export function snapshotPath(type, publicPath) {
    if (!/^[a-z0-9][a-z0-9._-]*\.md$/.test(publicPath))
        throw new Error(`Invalid public filename: ${publicPath}`);
    const directory = type === "post" ? "posts" : type === "page" ? "pages" : "now";
    return `content/${directory}/${publicPath}`;
}
export function parseWritingDocument(source, path, remoteSha = "") {
    const { metadata, body } = parseFrontmatter(source);
    const type = path.includes("/pages/")
        ? "page"
        : path.includes("/now/")
            ? "now"
            : "post";
    const slug = metadata.slug || path.split("/").pop()?.replace(/\.md$/, "") || "";
    return {
        id: metadata.id || path,
        identityPersisted: Boolean(metadata.id),
        legacyIds: metadata.legacyIds ? JSON.parse(metadata.legacyIds) : [],
        publicPath: metadata.publicPath || path.split("/").at(-1),
        aliases: metadata.aliases ? JSON.parse(metadata.aliases) : [],
        metadata: Object.fromEntries(Object.entries(metadata).filter(([key]) => !["id", "legacyIds", "aliases", "title", "slug", "date", "status", "publishedAt", "updatedAt", "sourceLabel", "sourceHref", "type", "publicPath"].includes(key))),
        path: metadata.publicPath && !metadata.publicPath.includes("/") ? snapshotPath(type, metadata.publicPath) : path,
        type,
        slug,
        title: metadata.title || "Untitled",
        date: type !== "page" ? metadata.date || new Date().toISOString().slice(0, 10) : "",
        status: type !== "page" && metadata.status === "draft" ? "draft" : "published",
        publishedAt: metadata.publishedAt || "",
        publicUpdatedAt: type === "post" ? metadata.updatedAt || "" : "",
        body,
        source: metadata.sourceLabel && metadata.sourceHref
            ? { label: metadata.sourceLabel, href: metadata.sourceHref }
            : undefined,
        remoteSha,
        publishedSource: source.trim(),
        updatedAt: new Date().toISOString(),
        googleDocId: "",
        driveRevision: "",
        driveSyncedBody: body,
    };
}
export function serializeWritingDocument(document) {
    const metadata = [
        "---",
        `id: ${quote(document.id)}`,
        `publicPath: ${quote(document.publicPath || document.path.split("/").at(-1) || "")}`,
        ...(document.legacyIds?.length ? [`legacyIds: ${JSON.stringify(document.legacyIds)}`] : []),
        `aliases: ${JSON.stringify(document.aliases || [])}`,
        ...Object.entries(document.metadata || {}).map(([key, value]) => `${key}: ${quote(value)}`),
        `title: ${quote(document.title.trim() || "Untitled")}`,
        `slug: ${document.slug}`,
    ];
    if (document.type !== "page") {
        metadata.push(`date: ${document.date || new Date().toISOString().slice(0, 10)}`, `status: ${document.status}`);
        if (document.publishedAt) {
            metadata.push(`publishedAt: ${document.publishedAt}`);
        }
        if (document.type === "post" && document.publicUpdatedAt) {
            metadata.push(`updatedAt: ${document.publicUpdatedAt}`);
        }
        if (document.source?.label && document.source?.href) {
            metadata.push(`sourceLabel: ${quote(document.source.label.trim())}`);
            metadata.push(`sourceHref: ${quote(document.source.href.trim())}`);
        }
    }
    metadata.push("---", "", document.body.trim(), "");
    return metadata.join("\n");
}
export function normalizeIncomingDocument(input, existing) {
    const type = existing?.type || (input.type === "page" ? "page" : input.type === "now" ? "now" : "post");
    if (existing && input.id && input.id !== existing.id)
        throw new Error("Document IDs cannot change.");
    const title = String(input.title || "").trim() || (type === "now" ? "Now" : "Untitled");
    const date = String(input.date || existing?.date || new Date().toISOString().slice(0, 10));
    const slug = type === "page"
        ? existing?.slug || slugify(String(input.slug || title))
        : type === "now"
            ? existing?.slug || slugify(String(input.slug || `now-${date}-${Date.now()}`))
            : String(input.slug || existing?.slug || slugify(title));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
        throw new Error("Use a public slug with lowercase letters, numbers, and hyphens.");
    const path = type === "page"
        ? existing?.path || `content/pages/${slug}.md`
        : type === "now"
            ? existing?.path || `content/now/${slug}.md`
            : existing?.path || `content/posts/${slug}.md`;
    if (type === "page" && !["about", "links", "ai"].includes(slug)) {
        throw new Error("Only the About, Links, and AI pages can be edited here.");
    }
    const source = input.source?.label?.trim() && input.source?.href?.trim()
        ? {
            label: input.source.label.trim(),
            href: input.source.href.trim(),
        }
        : undefined;
    return {
        id: existing?.id || crypto.randomUUID(),
        identityPersisted: true,
        publicPath: existing?.publicPath || path.split("/").at(-1),
        legacyIds: existing?.legacyIds || [],
        aliases: [...new Set([...(existing?.aliases || []), ...(existing && existing.slug !== slug ? [`/${existing.slug}.html`] : [])])],
        kdrivePath: existing?.kdrivePath,
        kdriveEtag: existing?.kdriveEtag,
        metadata: existing?.metadata,
        path,
        type,
        slug,
        title,
        date: type !== "page" ? date : "",
        status: type !== "page" && input.status === "published" ? "published" : type === "page" ? "published" : "draft",
        publishedAt: type !== "page" ? String(input.publishedAt || existing?.publishedAt || "") : "",
        publicUpdatedAt: type === "post" ? String(existing?.publicUpdatedAt || "") : "",
        body: String(input.body || ""),
        source: type === "post" ? source : undefined,
        remoteSha: existing?.remoteSha || String(input.remoteSha || ""),
        publishedSource: existing?.publishedSource || String(input.publishedSource || ""),
        updatedAt: new Date().toISOString(),
        googleDocId: existing?.googleDocId || String(input.googleDocId || ""),
        driveRevision: existing?.driveRevision || String(input.driveRevision || ""),
        driveSyncedBody: existing?.driveSyncedBody || String(input.driveSyncedBody || ""),
    };
}
export function isDocumentDirty(document) {
    if (!document.publishedSource.trim())
        return true;
    const previous = parseWritingDocument(document.publishedSource, document.path);
    return serializeWritingDocument(document).trim() !== serializeWritingDocument({ ...previous, id: document.id, legacyIds: document.legacyIds }).trim();
}
export function markRevisedPost(document, revisedAt = new Date().toISOString()) {
    if (document.type !== "post" ||
        document.status !== "published" ||
        !document.publishedSource.trim() ||
        !isDocumentDirty(document)) {
        return document;
    }
    return { ...document, publicUpdatedAt: revisedAt };
}
//# sourceMappingURL=content.js.map