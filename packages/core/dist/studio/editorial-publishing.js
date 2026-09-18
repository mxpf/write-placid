import { markRevisedPost, serializeWritingDocument } from "./content.js";
import { assertValidRepository } from "./editorial.js";
import { assertPublicContract, publishEditorialSnapshot } from "./github.js";
import { saveKdrivePost } from "./kdrive.js";
import { publishDocumentImages } from "./publish-images.js";
export async function publishEditorialRepository(documents, options = {}) {
    assertPublicContract();
    assertValidRepository(documents);
    for (const document of documents) {
        if (document.status !== "published")
            continue;
        const revised = markRevisedPost({ ...document, publishedAt: document.publishedAt || new Date().toISOString() });
        if (serializeWritingDocument(revised) !== serializeWritingDocument(document)) {
            await saveKdrivePost(revised, document);
            Object.assign(document, revised);
        }
        await publishDocumentImages(document);
    }
    const result = await publishEditorialSnapshot(documents);
    if (options.cacheDocuments)
        await options.cacheDocuments(documents);
    return result;
}
//# sourceMappingURL=editorial-publishing.js.map