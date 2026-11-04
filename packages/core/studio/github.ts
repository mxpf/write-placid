import { serializeWritingDocument as serializeCanonical } from "./content.ts";
import {
  buildPublishablePublicSnapshot,
  publicPublicationManifestPath,
} from "./editorial.ts";
import {
  parseWritingDocument,
  type WritingDocument,
} from "./content.ts";

const owner = process.env.WRITE_PLACID_GITHUB_OWNER || "your-github-name";
const repository = process.env.WRITE_PLACID_GITHUB_REPO || "write-placid";
const branch = process.env.WRITE_PLACID_GITHUB_BRANCH || "main";
const contentRoot = (process.env.WRITE_PLACID_GITHUB_CONTENT_ROOT === undefined
  ? "apps/site"
  : process.env.WRITE_PLACID_GITHUB_CONTENT_ROOT).trim().replace(/^\/+|\/+$/g, "");
const apiRoot = `https://api.github.com/repos/${owner}/${repository}`;

function repositoryPath(pathname: string) {
  return contentRoot ? `${contentRoot}/${pathname}` : pathname;
}

function documentPath(pathname: string) {
  const prefix = contentRoot ? `${contentRoot}/` : "";
  return prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
}

type GithubFile = {
  type: "file";
  path: string;
  sha: string;
  content?: string;
};

type GithubDirectoryEntry = {
  type: "file" | "dir";
  path: string;
  name: string;
  sha: string;
};

export type PublicationAssets = Record<string, Uint8Array>;

function githubHeaders(write = false) {
  const token = process.env.WRITE_PLACID_GITHUB_TOKEN?.trim();
  if (write && !token) {
    throw new Error(
      "Publishing needs its one-time GitHub connection. Your draft is still saved.",
    );
  }

  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Write-Placid-Studio",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFetch<T>(
  pathname: string,
  init: RequestInit = {},
  options: { allowNotFound?: boolean; write?: boolean } = {},
): Promise<T | null> {
  const response = await fetch(`${apiRoot}${pathname}`, {
    ...init,
    headers: {
      ...githubHeaders(options.write),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (response.status === 404 && options.allowNotFound) return null;
  if (!response.ok) {
    let message = `GitHub returned ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Keep the status-based message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function encodePath(pathname: string) {
  return pathname.split("/").map(encodeURIComponent).join("/");
}

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBytesBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function publicImagePath(name: string) {
  if (!/^[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp|gif)$/i.test(name)) {
    throw new Error("That image name is invalid.");
  }
  return `public/images/${name}`;
}

async function readGithubFile(pathname: string, ref = branch, write = false) {
  const target = repositoryPath(pathname);
  const file = await githubFetch<GithubFile>(
    `/contents/${encodePath(target)}?ref=${encodeURIComponent(ref)}`,
    {},
    { write },
  );
  if (!file?.content) throw new Error(`Could not read ${pathname}.`);
  return {
    source: decodeBase64(file.content),
    sha: file.sha,
  };
}

async function listGithubDirectory(pathname: string) {
  const target = repositoryPath(pathname);
  const result = await githubFetch<GithubDirectoryEntry[]>(
    `/contents/${encodePath(target)}?ref=${encodeURIComponent(branch)}`,
    {},
    { allowNotFound: true },
  );
  if (result === null) return [];
  if (!Array.isArray(result)) throw new Error(`Could not list ${pathname}.`);
  return result.filter((entry) => entry.type === "file" && entry.name.endsWith(".md"));
}

export async function loadPublishedDocuments() {
  const [postEntries, pageEntries, nowEntries] = await Promise.all([
    listGithubDirectory("content/posts"),
    listGithubDirectory("content/pages"),
    listGithubDirectory("content/now"),
  ]);
  const entries = [...pageEntries, ...nowEntries, ...postEntries];
  return Promise.all(
    entries.map(async (entry) => {
      const path = documentPath(entry.path);
      const file = await readGithubFile(path);
      return parseWritingDocument(file.source, path, file.sha);
    }),
  );
}

export function assertPublicContract() {
  if (String(process.env.WRITE_PLACID_PUBLIC_CONTRACT_VERSION) !== "1") {
    throw new Error("Public snapshot contract v1 must be deployed and enabled before publishing.");
  }
}

/** One Git commit is the handoff boundary; no public runtime KDrive access. */
export async function publishEditorialSnapshot(
  documents: WritingDocument[],
  options: { assets?: PublicationAssets } = {},
) {
  assertPublicContract();
  const snapshot = await buildPublishablePublicSnapshot(documents);
  const expectedEditorialChange = documents.some((document) => {
    const expected = document.status === "published" ? serializeCanonical(document).trim() : "";
    return document.publishedSource.trim() !== expected;
  });
  const assets = Object.entries(options.assets || {}).map(([name, bytes]) => ({
    path: repositoryPath(publicImagePath(name)),
    bytes,
  }));
  if (new Set(assets.map((asset) => asset.path)).size !== assets.length) {
    throw new Error("Duplicate publication image names are not allowed.");
  }
  const ref = await githubFetch<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`, {}, { write: true });
  if (!ref) throw new Error("Could not read the public branch.");
  const commit = await githubFetch<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`, {}, { write: true });
  const tree = await githubFetch<{ tree: { path: string; type: string; sha: string }[]; truncated: boolean }>(`/git/trees/${commit!.tree.sha}?recursive=1`, {}, { write: true });
  if (!tree || tree.truncated) throw new Error("Could not inspect the complete public snapshot.");
  const currentTree = new Map(tree.tree.map((entry) => [entry.path, entry.sha]));
  const assetBlobs = await Promise.all(assets.map(async (asset) => {
    const blob = await githubFetch<{ sha: string }>("/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content: encodeBytesBase64(asset.bytes), encoding: "base64" }),
    }, { write: true });
    if (!blob?.sha) throw new Error(`GitHub did not retain the publication image ${documentPath(asset.path)}.`);
    return { path: asset.path, sha: blob.sha };
  }));
  const expectedSnapshotChange = expectedEditorialChange || assetBlobs.some((asset) => currentTree.get(asset.path) !== asset.sha);
  const entries: { path: string; mode: string; type: string; content?: string; sha?: string | null }[] = [
    ...Object.entries(snapshot.files).map(([path, content]) => ({ path: repositoryPath(path), mode: "100644", type: "blob", content })),
    ...assetBlobs.map((asset) => ({ path: asset.path, mode: "100644", type: "blob", sha: asset.sha })),
  ];
  for (const entry of tree.tree) {
    const path = documentPath(entry.path);
    if (/^content\/(posts|pages|now)\/[^/]+\.md$/.test(path) && !(path in snapshot.files)) {
      if (!documents.some((document) => document.path === path)) throw new Error(`Public file has no canonical KDrive identity: ${path}. Complete migration or restore it to Drafts.`);
      entries.push({ path: entry.path, mode: "100644", type: "blob", sha: null });
    }
  }
  const nextTree = await githubFetch<{ sha: string }>("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: commit!.tree.sha, tree: entries }) }, { write: true });
  const publicationSource = snapshot.files[publicPublicationManifestPath];
  const verifyCommit = async (commitSha: string, expectedTreeSha: string) => {
    const candidate = await githubFetch<{ tree: { sha: string } }>(`/git/commits/${commitSha}`, {}, { write: true });
    if (candidate?.tree.sha !== expectedTreeSha) throw new Error("GitHub did not retain the complete intended publication tree.");
    const publishedManifest = await readGithubFile(publicPublicationManifestPath, commitSha, true);
    if (publishedManifest.source !== publicationSource) throw new Error("GitHub did not retain the intended publication content hashes.");
  };
  const acknowledge = (commitSha: string) => {
    for (const document of documents) {
      document.publishedSource = document.status === "published" ? serializeCanonical(document) : "";
      document.publishedRevision = document.status === "published" ? snapshot.revisions[document.id] || "" : "";
      document.remoteSha = document.status === "published" ? commitSha : "";
    }
  };
  if (nextTree!.sha === commit!.tree.sha) {
    if (expectedSnapshotChange) throw new Error("The public branch did not advance for changed editorial content. Nothing was marked live.");
    await verifyCommit(ref.object.sha, commit!.tree.sha);
    acknowledge(ref.object.sha);
    return { commit: ref.object.sha, manifest: snapshot.manifest, publication: snapshot.publication, revisions: snapshot.revisions, changed: false };
  }
  const nextCommit = await githubFetch<{ sha: string }>("/git/commits", { method: "POST", body: JSON.stringify({ message: "Publish validated Write Placid editorial snapshot", tree: nextTree!.sha, parents: [ref.object.sha] }) }, { write: true });
  // Verify the complete candidate commit before advancing main. Only the ref
  // update below can trigger the public build.
  await verifyCommit(nextCommit!.sha, nextTree!.sha);
  await githubFetch(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: nextCommit!.sha, force: false }) }, { write: true });
  const publishedRef = await githubFetch<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`, {}, { write: true });
  if (publishedRef?.object.sha !== nextCommit!.sha) throw new Error("GitHub did not advance the configured public branch to the verified snapshot.");
  acknowledge(nextCommit!.sha);
  return { commit: nextCommit!.sha, manifest: snapshot.manifest, publication: snapshot.publication, revisions: snapshot.revisions, changed: true };
}

export async function publishImageAsset(name: string, bytes: Uint8Array) {
  const path = repositoryPath(publicImagePath(name));
  const current = await githubFetch<GithubFile>(
    `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
    {},
    { allowNotFound: true, write: true },
  );
  const content = encodeBytesBase64(bytes);
  if (current?.content?.replace(/\s/g, "") === content) return;
  await githubFetch(
    `/contents/${encodePath(path)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add article image ${name}`,
        content,
        branch,
        ...(current?.sha ? { sha: current.sha } : {}),
      }),
    },
    { write: true },
  );
}
