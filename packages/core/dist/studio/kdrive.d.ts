import { type WritingDocument } from "./content.ts";
export type KdrivePostRef = {
    folder: string;
    type: WritingDocument["type"];
    status: WritingDocument["status"];
    name: string;
    etag: string;
};
export declare function kdriveConfigured(): boolean;
export declare function listKdrivePostRefs(): Promise<KdrivePostRef[]>;
export declare function readKdriveSource(ref: KdrivePostRef): Promise<string>;
export declare function loadKdrivePost(ref: KdrivePostRef): Promise<{
    type: "post" | "page" | "now";
    status: "draft" | "published";
    aliases: string[];
    kdrivePath: string;
    kdriveEtag: string;
    remoteSha: string;
    publishedSource: string;
    id: string;
    editBase?: string;
    path: string;
    publicPath?: string;
    legacyIds?: string[];
    identityPersisted?: boolean;
    metadata?: Record<string, string>;
    slug: string;
    title: string;
    date: string;
    publishedAt: string;
    publicUpdatedAt: string;
    body: string;
    source?: {
        label: string;
        href: string;
    };
    updatedAt: string;
    googleDocId: string;
    driveRevision: string;
    driveSyncedBody: string;
}>;
export declare function loadKdrivePosts(cached?: WritingDocument[]): Promise<WritingDocument[]>;
export declare function editorialLocation(document: WritingDocument): string;
export declare function saveKdrivePost(document: WritingDocument, previous?: WritingDocument): Promise<void>;
export declare function deleteKdrivePost(document: WritingDocument): Promise<boolean>;
export declare function saveKdriveImage(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
export declare function loadKdriveImage(name: string): Promise<{
    bytes: Uint8Array<ArrayBuffer>;
    contentType: string;
} | null>;
//# sourceMappingURL=kdrive.d.ts.map