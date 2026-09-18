export declare function imageContentType(name: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export declare function validateImageUpload(bytes: Uint8Array, articleSlug: string): {
    name: string;
    contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};
export declare function validImageName(name: string): boolean;
//# sourceMappingURL=image-files.d.ts.map