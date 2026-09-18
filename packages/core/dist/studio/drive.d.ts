import type { WritingDocument } from "./content.ts";
export type DriveDocument = {
    id: string;
    title: string;
    body: string;
    revision: string;
};
export type DriveDocumentSummary = Omit<DriveDocument, "body">;
export type DriveSyncResult = {
    state: "synced" | "pulled" | "pushed" | "conflict" | "created";
    document: WritingDocument;
    remoteBody?: string;
};
export type DriveBridgeOptions = {
    url: string;
    secret: string;
    fetch?: typeof globalThis.fetch;
    validateUrl?: (url: URL) => boolean;
    now?: () => string;
};
/** Instance configuration is injected; credentials never enter the reusable package. */
export declare function createDriveBridge(options: DriveBridgeOptions): {
    isConfigured: () => boolean;
    listDriveDocuments: () => Promise<DriveDocumentSummary[]>;
    getDriveDocument: (documentId: string) => Promise<DriveDocument>;
    createDriveDocument: (title: string, body: string) => Promise<DriveDocument>;
    syncDocumentWithRemote: (document: WritingDocument, remote: DriveDocument, resolution?: "auto" | "drive" | "studio") => Promise<DriveSyncResult>;
    syncDocument: (document: WritingDocument, resolution?: "auto" | "drive" | "studio") => Promise<DriveSyncResult>;
};
//# sourceMappingURL=drive.d.ts.map