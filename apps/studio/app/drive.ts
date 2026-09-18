import { createDriveBridge } from "@mxpf/write-placid-core/studio/drive";
export type { DriveDocument, DriveSyncResult } from "@mxpf/write-placid-core/studio/drive";

const bridge = createDriveBridge({ url: process.env.WRITE_PLACID_DRIVE_BRIDGE_URL || "", secret: process.env.WRITE_PLACID_DRIVE_BRIDGE_SECRET || "" });
export const isDriveConfigured = bridge.isConfigured;
export const listDriveDocuments = bridge.listDriveDocuments;
export const getDriveDocument = bridge.getDriveDocument;
export const createDriveDocument = bridge.createDriveDocument;
export const syncDocumentWithRemote = bridge.syncDocumentWithRemote;
export const syncDocument = bridge.syncDocument;
