import { type WritingDocument } from "./content.ts";
export type PublicationAssets = Record<string, Uint8Array>;
export declare function loadPublishedDocuments(): Promise<WritingDocument[]>;
export declare function assertPublicContract(): void;
/** One Git commit is the handoff boundary; no public runtime KDrive access. */
export declare function publishEditorialSnapshot(documents: WritingDocument[], options?: {
    assets?: PublicationAssets;
}): Promise<{
    commit: string;
    manifest: {
        version: number;
        documents: {
            id: string;
            type: "post" | "page" | "now";
            slug: string;
            path: string;
            url: string;
            aliases: string[];
        }[];
        redirects: {
            [k: string]: string;
        };
    };
    publication: import("./editorial.ts").PublicPublicationManifest;
    revisions: {
        [k: string]: string;
    };
    changed: boolean;
}>;
export declare function publishImageAsset(name: string, bytes: Uint8Array): Promise<void>;
//# sourceMappingURL=github.d.ts.map