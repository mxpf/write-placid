import {
  isDocumentDirty,
  markRevisedPost,
  type WritingDocument,
} from "./content";
import { publishDocument } from "./github";
import {
  kdriveConfigured,
  listKdrivePostRefs,
  loadKdrivePost,
  saveKdrivePost,
} from "./kdrive";
import {
  deleteDocument,
  findDocumentByPath,
  getSyncCursor,
  listDocuments,
  saveDocument,
  setSyncCursor,
} from "../db/documents";

const batchSize = 5;
const cursorKey = "kdrive-posts";

function mergeStudioMetadata(post: WritingDocument, existing?: WritingDocument) {
  if (!existing) return post;
  return {
    ...post,
    remoteSha: existing.remoteSha,
    publishedSource: existing.publishedSource,
    googleDocId: existing.googleDocId,
    driveRevision: existing.driveRevision,
    driveSyncedBody: existing.driveSyncedBody,
  };
}

export async function syncKdriveRepository() {
  if (!kdriveConfigured()) return { imported: 0, published: 0, unpublished: 0 };

  const refs = await listKdrivePostRefs();
  const storedCursor = await getSyncCursor(cursorKey);
  const cursor = storedCursor < refs.length ? storedCursor : 0;
  const selectedRefs = refs.slice(cursor, cursor + batchSize);
  const kdrivePosts = await Promise.all(selectedRefs.map(loadKdrivePost));
  let published = 0;
  let unpublished = 0;

  for (const kdrivePost of kdrivePosts) {
    const existing = await findDocumentByPath(kdrivePost.path);
    let document = mergeStudioMetadata(kdrivePost, existing);

    if (document.status === "published" && isDocumentDirty(document)) {
      if (!document.publishedAt) document.publishedAt = new Date().toISOString();
      document = markRevisedPost(document);
      document = await publishDocument(document);
      await saveKdrivePost(document, kdrivePost);
      published += 1;
    } else if (document.status === "draft" && document.remoteSha) {
      document = await publishDocument(document);
      unpublished += 1;
    }
    await saveDocument(document);
  }

  const kdriveIds = new Set(refs.map((ref) => `content/posts/${ref.name}`));
  for (const cached of await listDocuments()) {
    if (cached.type === "post" && !kdriveIds.has(cached.id)) {
      await deleteDocument(cached.id);
    }
  }

  const nextCursor =
    cursor + selectedRefs.length >= refs.length ? 0 : cursor + selectedRefs.length;
  await setSyncCursor(cursorKey, nextCursor);

  return {
    imported: kdrivePosts.length,
    published,
    unpublished,
    remaining: Math.max(0, refs.length - cursor - selectedRefs.length),
  };
}
