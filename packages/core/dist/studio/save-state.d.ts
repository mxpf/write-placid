import { type WritingDocument } from "./content.ts";
/** Publishing timestamps are server-owned and are not competing author edits. */
export declare function editableSource(document: WritingDocument): string;
export declare function withEditBase<T extends WritingDocument>(document: T): T;
/** Carry server revisions into the next save while preserving edits typed in flight. */
export declare function acknowledgeSave<T extends WritingDocument>(latest: T, saving: T, saved: T): T;
export declare function validateSaveRevision(input: Partial<WritingDocument>, existing?: WritingDocument): "This piece no longer exists. Reload Studio before saving." | "This piece has different writing in KDrive. Your edits are still in this tab. Copy them before reloading to compare versions." | "This piece changed since you opened it. Copy your edits before reloading Studio." | null;
export declare function planSave(input: Partial<WritingDocument>, existing?: WritingDocument): {
    document: WritingDocument;
    alreadySaved: boolean;
    error: string | null;
};
//# sourceMappingURL=save-state.d.ts.map