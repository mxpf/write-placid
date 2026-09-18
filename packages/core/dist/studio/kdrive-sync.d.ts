import type { WritingDocument } from "./content.ts";
export type RepositoryReconciliationDependencies = {
    isCanonicalConfigured: () => boolean;
    readEditorialRepository: () => Promise<WritingDocument[]>;
    listCachedDocuments: () => Promise<WritingDocument[]>;
    cacheDocuments: (documents: WritingDocument[]) => Promise<unknown>;
    deleteCachedDocument: (id: string) => Promise<unknown>;
    publishEditorialRepository: (documents: WritingDocument[]) => Promise<unknown>;
};
export declare function createRepositoryReconciliation(dependencies: RepositoryReconciliationDependencies): (options?: {
    publish?: boolean;
}) => Promise<{
    imported: number;
    published: number;
    unpublished: number;
}>;
//# sourceMappingURL=kdrive-sync.d.ts.map