import { type WritingDocument } from "./content.ts";
export declare function publishEditorialRepository(documents: WritingDocument[], options?: {
    cacheDocuments?: (documents: WritingDocument[]) => Promise<unknown>;
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
//# sourceMappingURL=editorial-publishing.d.ts.map