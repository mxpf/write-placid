/** All callers await the same queue, including edits made while a request runs. */
export declare function createSaveQueue<T>(options: {
    current: () => T | null;
    needsSave: (document: T) => boolean;
    save: (document: T) => Promise<T>;
    acknowledge: (saving: T, saved: T) => void;
    failed: (error: unknown) => void;
}): () => Promise<T | null>;
//# sourceMappingURL=save-queue.d.ts.map