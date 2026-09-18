import type { WritingDocument } from "./content.ts";

export type DriveDocument = { id: string; title: string; body: string; revision: string };
export type DriveDocumentSummary = Omit<DriveDocument, "body">;
export type DriveSyncResult = { state: "synced" | "pulled" | "pushed" | "conflict" | "created"; document: WritingDocument; remoteBody?: string };
type BridgeResponse<T> = { ok: true; result: T } | { ok: false; error?: string };

export type DriveBridgeOptions = {
  url: string;
  secret: string;
  fetch?: typeof globalThis.fetch;
  validateUrl?: (url: URL) => boolean;
  now?: () => string;
};

function normalizeBody(body: string) { return body.replace(/\r\n/g, "\n").trim(); }

/** Instance configuration is injected; credentials never enter the reusable package. */
export function createDriveBridge(options: DriveBridgeOptions) {
  const url = options.url.trim();
  const secret = options.secret.trim();
  const fetcher = options.fetch || globalThis.fetch;
  const now = options.now || (() => new Date().toISOString());
  let parsed: URL | undefined;
  if (url) {
    try { parsed = new URL(url); } catch { throw new Error("The Google Docs bridge URL is invalid."); }
    const valid = options.validateUrl ? options.validateUrl(parsed) : parsed.protocol === "https:" && parsed.hostname === "script.google.com";
    if (!valid) throw new Error("The Google Docs bridge must use an approved HTTPS URL.");
  }
  const isConfigured = () => Boolean(parsed && secret);

  async function callBridge<T>(action: string, input: Record<string, unknown> = {}) {
    if (!isConfigured()) throw new Error("Google Docs synchronization is not connected yet.");
    const response = await fetcher(parsed!.toString(), {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, action, ...input }), redirect: "follow", cache: "no-store",
    });
    if (!response.ok) throw new Error(`Google Docs returned ${response.status}.`);
    const payload = await response.json() as BridgeResponse<T>;
    if (!payload.ok) throw new Error(payload.error || "Google Docs could not finish syncing.");
    return payload.result;
  }
  const listDriveDocuments = () => callBridge<DriveDocumentSummary[]>("list");
  const getDriveDocument = (documentId: string) => callBridge<DriveDocument>("get", { documentId });
  const createDriveDocument = (title: string, body: string) => callBridge<DriveDocument>("create", { title, body });
  async function pushToDrive(document: WritingDocument, remote: DriveDocument) {
    const updated = await callBridge<DriveDocument>("put", { documentId: remote.id, title: document.title, body: normalizeBody(document.body), expectedRevision: remote.revision });
    return { ...document, googleDocId: updated.id, driveRevision: updated.revision, driveSyncedBody: normalizeBody(document.body), updatedAt: now() };
  }
  async function syncDocumentWithRemote(document: WritingDocument, remote: DriveDocument, resolution: "auto" | "drive" | "studio" = "auto"): Promise<DriveSyncResult> {
    const localBody = normalizeBody(document.body), remoteBody = normalizeBody(remote.body), baseBody = normalizeBody(document.driveSyncedBody || "");
    if (resolution === "drive") return { state: "pulled", document: { ...document, body: remoteBody, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody, updatedAt: now() } };
    if (resolution === "studio") return { state: "pushed", document: await pushToDrive(document, remote) };
    if (!baseBody) return localBody !== remoteBody ? { state: "conflict", document, remoteBody } : { state: "synced", document: { ...document, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody } };
    const localChanged = localBody !== baseBody, remoteChanged = remoteBody !== baseBody;
    if (localBody === remoteBody || (!localChanged && !remoteChanged)) return { state: "synced", document: { ...document, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody } };
    if (remoteChanged && !localChanged) return { state: "pulled", document: { ...document, body: remoteBody, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody, updatedAt: now() } };
    if (localChanged && !remoteChanged) return { state: "pushed", document: await pushToDrive(document, remote) };
    return { state: "conflict", document, remoteBody };
  }
  async function syncDocument(document: WritingDocument, resolution: "auto" | "drive" | "studio" = "auto") {
    if (!document.googleDocId) {
      const remote = await createDriveDocument(document.title, document.body);
      return { state: "created" as const, document: { ...document, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: normalizeBody(document.body) } };
    }
    return syncDocumentWithRemote(document, await getDriveDocument(document.googleDocId), resolution);
  }
  return { isConfigured, listDriveDocuments, getDriveDocument, createDriveDocument, syncDocumentWithRemote, syncDocument };
}
