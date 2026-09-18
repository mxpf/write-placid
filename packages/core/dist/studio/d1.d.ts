import type { WritingDocument } from "./content.ts";
type D1Result<T = Record<string, unknown>> = {
    results?: T[];
};
type D1Statement = {
    bind: (...values: unknown[]) => D1Statement;
    run: () => Promise<unknown>;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
};
export type D1DatabaseLike = {
    prepare: (sql: string) => D1Statement;
    batch: (statements: any[]) => Promise<unknown>;
};
export type D1StoreOptions = {
    getD1: () => D1DatabaseLike;
    mappedGoogleDocId?: (path: string) => string;
    now?: () => string;
};
/** D1 persistence with request-time binding lookup and injected private document mapping. */
export declare function createD1Store(options: D1StoreOptions): {
    ensureSchema: () => Promise<void>;
    listDocuments: () => Promise<WritingDocument[]>;
    findDocument: (id: string) => Promise<WritingDocument>;
    findDocumentByPath: (path: string) => Promise<WritingDocument | undefined>;
    saveDocument: (document: WritingDocument, sortOrder?: number) => Promise<WritingDocument>;
    cacheDocuments: (items: WritingDocument[]) => Promise<void>;
    replaceDocument: (previousId: string, document: WritingDocument, sortOrder?: number) => Promise<WritingDocument>;
    reorderDraftDocuments: (ids: string[]) => Promise<void>;
    seedDocuments: (items: WritingDocument[]) => Promise<void>;
    deleteDocument: (id: string) => Promise<WritingDocument | undefined>;
    getSyncCursor: (key: string) => Promise<number>;
    setSyncCursor: (key: string, cursor: number) => Promise<void>;
};
export {};
//# sourceMappingURL=d1.d.ts.map