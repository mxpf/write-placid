import { type WritingDocument } from "./content.ts";
export declare const publicPublicationManifestPath = "public/write-placid-publication.json";
export type PublicPublicationManifest = {
    version: 1;
    documents: {
        id: string;
        path: string;
        url: string;
        revision: string;
    }[];
};
export declare function publicRevisionForDocument(publication: Partial<PublicPublicationManifest> | null, id: string): string;
export declare function livePublicationMatches(pageAvailable: boolean, publication: Partial<PublicPublicationManifest> | null, id: string, revision: string): boolean;
export declare function publicUrl(document: WritingDocument): string;
export declare function internalReferences(body: string): string[];
export declare function validateRepository(documents: WritingDocument[]): string[];
export declare function assertValidRepository(documents: WritingDocument[]): void;
export declare function buildPublicSnapshot(documents: WritingDocument[]): {
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
    files: Record<string, string>;
};
/** Add a public, non-sensitive revision index used to verify static deployment. */
export declare function buildPublishablePublicSnapshot(documents: WritingDocument[]): Promise<{
    publication: PublicPublicationManifest;
    revisions: {
        [k: string]: string;
    };
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
    files: Record<string, string>;
}>;
//# sourceMappingURL=editorial.d.ts.map