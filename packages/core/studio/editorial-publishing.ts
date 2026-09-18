import { markRevisedPost, serializeWritingDocument, type WritingDocument } from "./content.ts";
import { assertValidRepository } from "./editorial.ts";
import { assertPublicContract, publishEditorialSnapshot } from "./github.ts";
import { saveKdrivePost } from "./kdrive.ts";
import { publishDocumentImages } from "./publish-images.ts";
export async function publishEditorialRepository(documents: WritingDocument[], options: { cacheDocuments?: (documents: WritingDocument[]) => Promise<unknown> } = {}) {
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
  if (options.cacheDocuments) await options.cacheDocuments(documents);
  return result;
}
