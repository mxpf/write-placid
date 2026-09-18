import type { WritingDocument } from "./content.ts";
export declare function createEditorRecovery(prefix?: string): {
    rememberEdits: (storage: Storage, document: WritingDocument) => void;
    forgetEdits: (storage: Storage, id: string) => void;
    lastRecoveredDocument: (storage: Storage) => WritingDocument | null;
    recoverEdits: <T extends WritingDocument>(storage: Storage, saved: T) => T | null;
};
export declare const rememberEdits: (storage: Storage, document: WritingDocument) => void, forgetEdits: (storage: Storage, id: string) => void, lastRecoveredDocument: (storage: Storage) => WritingDocument | null, recoverEdits: <T extends WritingDocument>(storage: Storage, saved: T) => T | null;
//# sourceMappingURL=editor-recovery.d.ts.map