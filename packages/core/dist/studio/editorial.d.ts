import { type WritingDocument } from "./content.ts";
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
//# sourceMappingURL=editorial.d.ts.map