export declare function imageContentType(name: string): "image/gif" | "image/jpeg" | "image/png" | "image/webp";
export declare function validateImageUpload(bytes: Uint8Array, articleSlug: string): {
    name: string;
    contentType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
};
export declare function validImageName(name: string): boolean;
//# sourceMappingURL=image-files.d.ts.map