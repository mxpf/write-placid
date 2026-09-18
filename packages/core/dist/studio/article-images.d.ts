export type ArticleImage = {
    alt: string;
    src: string;
    title?: string;
};
export declare function isSafeImageSrc(src: string): boolean;
export declare function parseArticleImage(value: string): ArticleImage | null;
export declare function articleImageMarkdown(image: ArticleImage): string;
export declare function referencedLocalImages(markdown: string): string[];
//# sourceMappingURL=article-images.d.ts.map