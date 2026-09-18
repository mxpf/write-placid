function normalizeBody(body) { return body.replace(/\r\n/g, "\n").trim(); }
/** Instance configuration is injected; credentials never enter the reusable package. */
export function createDriveBridge(options) {
    const url = options.url.trim();
    const secret = options.secret.trim();
    const fetcher = options.fetch || globalThis.fetch;
    const now = options.now || (() => new Date().toISOString());
    let parsed;
    if (url) {
        try {
            parsed = new URL(url);
        }
        catch {
            throw new Error("The Google Docs bridge URL is invalid.");
        }
        const valid = options.validateUrl ? options.validateUrl(parsed) : parsed.protocol === "https:" && parsed.hostname === "script.google.com";
        if (!valid)
            throw new Error("The Google Docs bridge must use an approved HTTPS URL.");
    }
    const isConfigured = () => Boolean(parsed && secret);
    async function callBridge(action, input = {}) {
        if (!isConfigured())
            throw new Error("Google Docs synchronization is not connected yet.");
        const response = await fetcher(parsed.toString(), {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ secret, action, ...input }), redirect: "follow", cache: "no-store",
        });
        if (!response.ok)
            throw new Error(`Google Docs returned ${response.status}.`);
        const payload = await response.json();
        if (!payload.ok)
            throw new Error(payload.error || "Google Docs could not finish syncing.");
        return payload.result;
    }
    const listDriveDocuments = () => callBridge("list");
    const getDriveDocument = (documentId) => callBridge("get", { documentId });
    const createDriveDocument = (title, body) => callBridge("create", { title, body });
    async function pushToDrive(document, remote) {
        const updated = await callBridge("put", { documentId: remote.id, title: document.title, body: normalizeBody(document.body), expectedRevision: remote.revision });
        return { ...document, googleDocId: updated.id, driveRevision: updated.revision, driveSyncedBody: normalizeBody(document.body), updatedAt: now() };
    }
    async function syncDocumentWithRemote(document, remote, resolution = "auto") {
        const localBody = normalizeBody(document.body), remoteBody = normalizeBody(remote.body), baseBody = normalizeBody(document.driveSyncedBody || "");
        if (resolution === "drive")
            return { state: "pulled", document: { ...document, body: remoteBody, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody, updatedAt: now() } };
        if (resolution === "studio")
            return { state: "pushed", document: await pushToDrive(document, remote) };
        if (!baseBody)
            return localBody !== remoteBody ? { state: "conflict", document, remoteBody } : { state: "synced", document: { ...document, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody } };
        const localChanged = localBody !== baseBody, remoteChanged = remoteBody !== baseBody;
        if (localBody === remoteBody || (!localChanged && !remoteChanged))
            return { state: "synced", document: { ...document, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody } };
        if (remoteChanged && !localChanged)
            return { state: "pulled", document: { ...document, body: remoteBody, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: remoteBody, updatedAt: now() } };
        if (localChanged && !remoteChanged)
            return { state: "pushed", document: await pushToDrive(document, remote) };
        return { state: "conflict", document, remoteBody };
    }
    async function syncDocument(document, resolution = "auto") {
        if (!document.googleDocId) {
            const remote = await createDriveDocument(document.title, document.body);
            return { state: "created", document: { ...document, googleDocId: remote.id, driveRevision: remote.revision, driveSyncedBody: normalizeBody(document.body) } };
        }
        return syncDocumentWithRemote(document, await getDriveDocument(document.googleDocId), resolution);
    }
    return { isConfigured, listDriveDocuments, getDriveDocument, createDriveDocument, syncDocumentWithRemote, syncDocument };
}
//# sourceMappingURL=drive.js.map