import {
  parseWritingDocument,
  serializeWritingDocument,
  type WritingDocument,
} from "./content";

const owner = process.env.WRITE_PLACID_GITHUB_OWNER || "your-github-name";
const repository = process.env.WRITE_PLACID_GITHUB_REPO || "write-placid";
const branch = process.env.WRITE_PLACID_GITHUB_BRANCH || "main";
const apiRoot = `https://api.github.com/repos/${owner}/${repository}`;

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

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function readGithubFile(pathname: string) {
  const file = await githubFetch<GithubFile>(
    `/contents/${encodePath(pathname)}?ref=${encodeURIComponent(branch)}`,
  );
  if (!file?.content) throw new Error(`Could not read ${pathname}.`);
  return {
    source: decodeBase64(file.content),
    sha: file.sha,
  };
}

async function listGithubDirectory(pathname: string) {
  const result = await githubFetch<GithubDirectoryEntry[]>(
    `/contents/${encodePath(pathname)}?ref=${encodeURIComponent(branch)}`,
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
      const file = await readGithubFile(entry.path);
      return parseWritingDocument(file.source, entry.path, file.sha);
    }),
  );
}

export async function publishDocument(document: WritingDocument) {
  const source = serializeWritingDocument(document);
  const previousPath =
    document.id.startsWith("content/") && document.id !== document.path
      ? document.id
      : document.path;
  const current = await githubFetch<GithubFile>(
    `/contents/${encodePath(document.path)}?ref=${encodeURIComponent(branch)}`,
    {},
    { allowNotFound: true, write: true },
  );
  const previous =
    previousPath === document.path
      ? current
      : await githubFetch<GithubFile>(
          `/contents/${encodePath(previousPath)}?ref=${encodeURIComponent(branch)}`,
          {},
          { allowNotFound: true, write: true },
        );

  if (document.type !== "page" && document.status === "draft") {
    const publishedFiles = [
      ...(current ? [{ path: document.path, file: current }] : []),
      ...(previousPath !== document.path && previous
        ? [{ path: previousPath, file: previous }]
        : []),
    ];
    for (const publishedFile of publishedFiles) {
      await githubFetch(
        `/contents/${encodePath(publishedFile.path)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Move ${document.title} to drafts`,
            sha: publishedFile.file.sha,
            branch,
          }),
        },
        { write: true },
      );
    }
    return {
      ...document,
      id: document.path,
      publishedSource: "",
      remoteSha: "",
      updatedAt: new Date().toISOString(),
    };
  }

  const result = await githubFetch<{ content: { sha: string } }>(
    `/contents/${encodePath(document.path)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:
          document.type === "page"
            ? `Publish ${document.title}`
            : document.status === "draft"
              ? `Move ${document.title} to drafts`
              : `Publish ${document.title}`,
        content: encodeBase64(source),
        branch,
        ...(current?.sha ? { sha: current.sha } : {}),
      }),
    },
    { write: true },
  );

  if (!result) throw new Error("GitHub did not return the published file.");
  if (previousPath !== document.path && previous) {
    await githubFetch(
      `/contents/${encodePath(previousPath)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Move ${document.title} to its new address`,
          sha: previous.sha,
          branch,
        }),
      },
      { write: true },
    );
  }
  return {
    ...document,
    id: document.path,
    remoteSha: result.content.sha,
    publishedSource: source.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteGithubDocument(document: WritingDocument) {
  const paths = [
    ...new Set(
      [document.path, document.id].filter((path) => path.startsWith("content/")),
    ),
  ];
  let removed = false;
  for (const path of paths) {
    const current = await githubFetch<GithubFile>(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
      {},
      { allowNotFound: true },
    );
    if (!current) continue;

    await githubFetch(
      `/contents/${encodePath(path)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete ${document.title}`,
          sha: current.sha,
          branch,
        }),
      },
      { write: true },
    );
    removed = true;
  }
  return removed;
}
