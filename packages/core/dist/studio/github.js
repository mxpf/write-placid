import { serializeWritingDocument as serializeCanonical } from "./content.js";
import { buildPublicSnapshot } from "./editorial.js";
import { parseWritingDocument, } from "./content.js";
const owner = process.env.WRITE_PLACID_GITHUB_OWNER || "your-github-name";
const repository = process.env.WRITE_PLACID_GITHUB_REPO || "write-placid";
const branch = process.env.WRITE_PLACID_GITHUB_BRANCH || "main";
const contentRoot = (process.env.WRITE_PLACID_GITHUB_CONTENT_ROOT || "apps/site").trim().replace(/^\/+|\/+$/g, "");
const apiRoot = `https://api.github.com/repos/${owner}/${repository}`;
function repositoryPath(pathname) {
    return contentRoot ? `${contentRoot}/${pathname}` : pathname;
}
function documentPath(pathname) {
    const prefix = contentRoot ? `${contentRoot}/` : "";
    return prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
}
function githubHeaders(write = false) {
    const token = process.env.WRITE_PLACID_GITHUB_TOKEN?.trim();
    if (write && !token) {
        throw new Error("Publishing needs its one-time GitHub connection. Your draft is still saved.");
    }
    return {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Write-Placid-Studio",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}
async function githubFetch(pathname, init = {}, options = {}) {
    const response = await fetch(`${apiRoot}${pathname}`, {
        ...init,
        headers: {
            ...githubHeaders(options.write),
            ...(init.headers || {}),
        },
        cache: "no-store",
    });
    if (response.status === 404 && options.allowNotFound)
        return null;
    if (!response.ok) {
        let message = `GitHub returned ${response.status}.`;
        try {
            const body = (await response.json());
            if (body.message)
                message = body.message;
        }
        catch {
            // Keep the status-based message.
        }
        throw new Error(message);
    }
    return (await response.json());
}
function encodePath(pathname) {
    return pathname.split("/").map(encodeURIComponent).join("/");
}
function decodeBase64(value) {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
function encodeBytesBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
}
async function readGithubFile(pathname) {
    const target = repositoryPath(pathname);
    const file = await githubFetch(`/contents/${encodePath(target)}?ref=${encodeURIComponent(branch)}`);
    if (!file?.content)
        throw new Error(`Could not read ${pathname}.`);
    return {
        source: decodeBase64(file.content),
        sha: file.sha,
    };
}
async function listGithubDirectory(pathname) {
    const target = repositoryPath(pathname);
    const result = await githubFetch(`/contents/${encodePath(target)}?ref=${encodeURIComponent(branch)}`, {}, { allowNotFound: true });
    if (result === null)
        return [];
    if (!Array.isArray(result))
        throw new Error(`Could not list ${pathname}.`);
    return result.filter((entry) => entry.type === "file" && entry.name.endsWith(".md"));
}
export async function loadPublishedDocuments() {
    const [postEntries, pageEntries, nowEntries] = await Promise.all([
        listGithubDirectory("content/posts"),
        listGithubDirectory("content/pages"),
        listGithubDirectory("content/now"),
    ]);
    const entries = [...pageEntries, ...nowEntries, ...postEntries];
    return Promise.all(entries.map(async (entry) => {
        const path = documentPath(entry.path);
        const file = await readGithubFile(path);
        return parseWritingDocument(file.source, path, file.sha);
    }));
}
export function assertPublicContract() {
    if (String(process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION) !== "1") {
        throw new Error("Public snapshot contract v1 must be deployed and enabled before publishing.");
    }
}
/** One Git commit is the handoff boundary; no public runtime KDrive access. */
export async function publishEditorialSnapshot(documents) {
    assertPublicContract();
    const snapshot = buildPublicSnapshot(documents);
    const ref = await githubFetch(`/git/ref/heads/${encodeURIComponent(branch)}`, {}, { write: true });
    if (!ref)
        throw new Error("Could not read the public branch.");
    const commit = await githubFetch(`/git/commits/${ref.object.sha}`, {}, { write: true });
    const tree = await githubFetch(`/git/trees/${commit.tree.sha}?recursive=1`, {}, { write: true });
    if (!tree || tree.truncated)
        throw new Error("Could not inspect the complete public snapshot.");
    const entries = Object.entries(snapshot.files).map(([path, content]) => ({ path: repositoryPath(path), mode: "100644", type: "blob", content }));
    for (const entry of tree.tree) {
        const path = documentPath(entry.path);
        if (/^content\/(posts|pages|now)\/[^/]+\.md$/.test(path) && !(path in snapshot.files)) {
            if (!documents.some((document) => document.path === path))
                throw new Error(`Public file has no canonical KDrive identity: ${path}. Complete migration or restore it to Drafts.`);
            entries.push({ path: entry.path, mode: "100644", type: "blob", sha: null });
        }
    }
    const nextTree = await githubFetch("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries }) }, { write: true });
    if (nextTree.sha === commit.tree.sha) {
        for (const document of documents) {
            document.publishedSource = document.status === "published" ? serializeCanonical(document) : "";
            document.remoteSha = document.status === "published" ? ref.object.sha : "";
        }
        return { commit: ref.object.sha, manifest: snapshot.manifest };
    }
    const nextCommit = await githubFetch("/git/commits", { method: "POST", body: JSON.stringify({ message: "Publish validated Write Placid editorial snapshot", tree: nextTree.sha, parents: [ref.object.sha] }) }, { write: true });
    await githubFetch(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: nextCommit.sha, force: false }) }, { write: true });
    for (const document of documents) {
        // The comparison baseline retains ID links, while public files contain resolved URLs.
        document.publishedSource = document.status === "published" ? serializeCanonical(document) : "";
        document.remoteSha = document.status === "published" ? nextCommit.sha : "";
    }
    return { commit: nextCommit.sha, manifest: snapshot.manifest };
}
export async function publishImageAsset(name, bytes) {
    if (!/^[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp|gif)$/i.test(name)) {
        throw new Error("That image name is invalid.");
    }
    const path = repositoryPath(`public/images/${name}`);
    const current = await githubFetch(`/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, {}, { allowNotFound: true, write: true });
    const content = encodeBytesBase64(bytes);
    if (current?.content?.replace(/\s/g, "") === content)
        return;
    await githubFetch(`/contents/${encodePath(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: `Add article image ${name}`,
            content,
            branch,
            ...(current?.sha ? { sha: current.sha } : {}),
        }),
    }, { write: true });
}
//# sourceMappingURL=github.js.map