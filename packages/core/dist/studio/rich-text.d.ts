import { type ArticleImage } from "./article-images.ts";
export declare function readEditorImage(figure: HTMLElement): ArticleImage | null;
/** Change image text in place so its source, surrounding writing and selection survive. */
export declare function updateEditorImage(figure: HTMLElement, details: Pick<ArticleImage, "alt" | "title">): boolean;
export declare function markdownToEditorHtml(markdown: string): string;
export declare function markdownPasteToEditorHtml(value: string): string | null;
export declare function numberedListShortcutStart(value: string): number | null;
export declare function editorToMarkdown(editor: HTMLElement): string;
//# sourceMappingURL=rich-text.d.ts.map