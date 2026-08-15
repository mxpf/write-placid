import type { WritingDocument } from "./content";

export type DriveDocument = {
  id: string;
  title: string;
  body: string;
  revision: string;
};

type DriveDocumentSummary = Omit<DriveDocument, "body">;

export type DriveSyncResult = {
  state: "synced" | "pulled" | "pushed" | "conflict" | "created";
  document: WritingDocument;
  remoteBody?: string;
};

type BridgeResponse<T> = { ok: true; result: T } | { ok: false; error?: string };

function bridgeConfiguration() {
  const url = process.env.WRITE_PLACID_DRIVE_BRIDGE_URL?.trim() || "";
  const secret = process.env.WRITE_PLACID_DRIVE_BRIDGE_SECRET?.trim() || "";
  if (!url || !secret) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The Google Docs bridge URL is invalid.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "script.google.com") {
    throw new Error("The Google Docs bridge must use a script.google.com HTTPS URL.");
  }
  return { url: parsed.toString(), secret };
}

export function isDriveConfigured() {
  return Boolean(bridgeConfiguration());
}

async function callBridge<T>(action: string, input: Record<string, unknown> = {}) {
  const configuration = bridgeConfiguration();
  if (!configuration) {
    throw new Error("Google Docs synchronization is not connected yet.");
  }

  const response = await fetch(configuration.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: configuration.secret, action, ...input }),
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google Docs returned ${response.status}.`);
  const payload = (await response.json()) as BridgeResponse<T>;
  if (!payload.ok) throw new Error(payload.error || "Google Docs could not finish syncing.");
  return payload.result;
}

export function listDriveDocuments() {
  return callBridge<DriveDocumentSummary[]>("list");
}

export function getDriveDocument(documentId: string) {
  return callBridge<DriveDocument>("get", { documentId });
}

export function createDriveDocument(title: string, body: string) {
  return callBridge<DriveDocument>("create", { title, body });
}

function normalizeBody(body: string) {
  return body.replace(/\r\n/g, "\n").trim();
}

async function pushToDrive(document: WritingDocument, remote: DriveDocument) {
  const updated = await callBridge<DriveDocument>("put", {
    documentId: remote.id,
    title: document.title,
    body: normalizeBody(document.body),
    expectedRevision: remote.revision,
  });
  return {
    ...document,
    googleDocId: updated.id,
    driveRevision: updated.revision,
    driveSyncedBody: normalizeBody(document.body),
    updatedAt: new Date().toISOString(),
  };
}

export async function syncDocumentWithRemote(
  document: WritingDocument,
  remote: DriveDocument,
  resolution: "auto" | "drive" | "studio" = "auto",
): Promise<DriveSyncResult> {
  const localBody = normalizeBody(document.body);
  const remoteBody = normalizeBody(remote.body);
  const baseBody = normalizeBody(document.driveSyncedBody || "");

  if (resolution === "drive") {
    return {
      state: "pulled",
      document: {
        ...document,
        body: remoteBody,
        googleDocId: remote.id,
        driveRevision: remote.revision,
        driveSyncedBody: remoteBody,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (resolution === "studio") {
    return { state: "pushed", document: await pushToDrive(document, remote) };
  }

  if (!baseBody) {
    if (localBody !== remoteBody) {
      return { state: "conflict", document, remoteBody };
    }
    return {
      state: "synced",
      document: {
        ...document,
        googleDocId: remote.id,
        driveRevision: remote.revision,
        driveSyncedBody: remoteBody,
      },
    };
  }

  const localChanged = localBody !== baseBody;
  const remoteChanged = remoteBody !== baseBody;

  if (localBody === remoteBody || (!localChanged && !remoteChanged)) {
    return {
      state: "synced",
      document: {
        ...document,
        googleDocId: remote.id,
        driveRevision: remote.revision,
        driveSyncedBody: remoteBody,
      },
    };
  }
  if (remoteChanged && !localChanged) {
    return {
      state: "pulled",
      document: {
        ...document,
        body: remoteBody,
        googleDocId: remote.id,
        driveRevision: remote.revision,
        driveSyncedBody: remoteBody,
        updatedAt: new Date().toISOString(),
      },
    };
  }
  if (localChanged && !remoteChanged) {
    return { state: "pushed", document: await pushToDrive(document, remote) };
  }

  return { state: "conflict", document, remoteBody };
}

export async function syncDocument(
  document: WritingDocument,
  resolution: "auto" | "drive" | "studio" = "auto",
) {
  if (!document.googleDocId) {
    const remote = await createDriveDocument(document.title, document.body);
    return {
      state: "created" as const,
      document: {
        ...document,
        googleDocId: remote.id,
        driveRevision: remote.revision,
        driveSyncedBody: normalizeBody(document.body),
      },
    };
  }
  const remote = await getDriveDocument(document.googleDocId);
  return syncDocumentWithRemote(document, remote, resolution);
}
