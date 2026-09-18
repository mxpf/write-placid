import type { WritingDocument } from "./content.ts";
export type EditorialRepositoryDependencies = {
    listCachedDocuments: () => Promise<WritingDocument[]>;
    loadCanonicalDocuments: (cached: WritingDocument[]) => Promise<WritingDocument[]>;
    saveCanonicalDocument: (document: WritingDocument, previous?: WritingDocument) => Promise<unknown>;
    saveCachedDocument: (document: WritingDocument) => Promise<unknown>;
};
export declare class EditorialConflictError extends Error {
}
/** Canonical-first repository orchestration with immutable identity and URL-history checks. */
export declare function createEditorialRepository(dependencies: EditorialRepositoryDependencies): {
    readEditorialRepository: () => Promise<WritingDocument[]>;
    saveEditorialDocument: (document: WritingDocument, previous?: WritingDocument) => Promise<WritingDocument>;
    saveIncomingEditorialDocument: (input: Partial<WritingDocument>) => Promise<WritingDocument>;
};
//# sourceMappingURL=editorial-repository.d.ts.map