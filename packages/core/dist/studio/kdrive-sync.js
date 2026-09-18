export function createRepositoryReconciliation(dependencies) {
    return async function syncCanonicalRepository(options = {}) {
        if (!dependencies.isCanonicalConfigured())
            throw new Error("The canonical repository is unavailable; Studio will not use cached content as the source of truth.");
        const documents = await dependencies.readEditorialRepository();
        const cached = await dependencies.listCachedDocuments();
        const ids = new Set(documents.map((document) => document.id));
        const removed = cached.filter((document) => !ids.has(document.id));
        if (removed.some((document) => !document.kdrivePath))
            throw new Error("Legacy Studio documents still need migration into the canonical repository.");
        if (options.publish)
            await dependencies.publishEditorialRepository(documents);
        else {
            await dependencies.cacheDocuments(documents.filter((document) => {
                const previous = cached.find((item) => item.id === document.id);
                return !previous || previous.kdriveEtag !== document.kdriveEtag || previous.kdrivePath !== document.kdrivePath || previous.status !== document.status;
            }));
        }
        for (const document of removed)
            await dependencies.deleteCachedDocument(document.id);
        return {
            imported: documents.length,
            published: options.publish ? documents.filter((document) => document.status === "published").length : 0,
            unpublished: removed.length,
        };
    };
}
//# sourceMappingURL=kdrive-sync.js.map