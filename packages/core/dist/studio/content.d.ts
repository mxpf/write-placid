export type WritingDocument = {
    id: string;
    editBase?: string;
    path: string;
    publicPath?: string;
    legacyIds?: string[];
    aliases?: string[];
    kdrivePath?: string;
    kdriveEtag?: string;
    identityPersisted?: boolean;
    metadata?: Record<string, string>;
    type: "post" | "page" | "now";
    slug: string;
    title: string;
    date: string;
    status: "draft" | "published";
    publishedAt: string;
    publicUpdatedAt: string;
    body: string;
    source?: {
        label: string;
        href: string;
    };
    remoteSha: string;
    publishedSource: string;
    updatedAt: string;
    googleDocId: string;
    driveRevision: string;
    driveSyncedBody: string;
};
export declare function calculateReadingTime(body: string): string;
export declare function displayDate(value: string): string;
export declare function snapshotPath(type: WritingDocument["type"], publicPath: string): string;
export declare function parseWritingDocument(source: string, path: string, remoteSha?: string): WritingDocument;
export declare function serializeWritingDocument(document: WritingDocument): string;
export declare function normalizeIncomingDocument(input: Partial<WritingDocument>, existing?: WritingDocument): WritingDocument;
export declare function isDocumentDirty(document: WritingDocument): boolean;
export declare function markRevisedPost(document: WritingDocument, revisedAt?: string): WritingDocument;
//# sourceMappingURL=content.d.ts.map