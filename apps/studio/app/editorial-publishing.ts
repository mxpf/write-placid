import { markRevisedPost, serializeWritingDocument, type WritingDocument } from "./content";
import { assertValidRepository } from "./editorial";
import { assertPublicContract, publishEditorialSnapshot } from "./github";
import { saveKdrivePost } from "./kdrive";
import { publishDocumentImages } from "./publish-images";
import { cacheDocuments } from "../db/documents";

export async function publishEditorialRepository(documents: WritingDocument[]) {
  assertPublicContract();
  assertValidRepository(documents);
  for (const document of documents) {
    if (document.status !== "published") continue;
    const revised = markRevisedPost({ ...document, publishedAt: document.publishedAt || new Date().toISOString() });
    if (serializeWritingDocument(revised) !== serializeWritingDocument(document)) {
      await saveKdrivePost(revised, document);
      Object.assign(document, revised);
    }
    await publishDocumentImages(document);
  }
  const result = await publishEditorialSnapshot(documents);
  await cacheDocuments(documents);
  return result;
}
