/** Caption-only Markdown: text, single-marker emphasis, and safe inline links. */
export type CaptionRun = {
    text: string;
    italic?: boolean;
    href?: string;
};
export declare function safeCaptionHref(value: string): string | null;
export declare function escapeCaptionText(value: string): string;
export declare function parseCaption(value: string): CaptionRun[];
export declare function captionToHtml(value: string): string;
export declare function captionToText(value: string): string;
export declare function captionRunsToMarkdown(input: CaptionRun[]): string;
/** Read only allowed formatting from an inert pasted DOM or the caption editor. */
export declare function captionDomToMarkdown(root: Node): string;
//# sourceMappingURL=caption-inline.d.ts.map