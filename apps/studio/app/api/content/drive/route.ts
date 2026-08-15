import { isDocumentDirty, normalizeIncomingDocument } from "../../../content";
import {
  isDriveConfigured,
  getDriveDocument,
  listDriveDocuments,
  syncDocument,
  syncDocumentWithRemote,
} from "../../../drive";
import { authorizeStudioRequest } from "../../../server-auth";
import {
  findDocument,
  listDocuments,
  saveDocument,
} from "../../../../db/documents";

type DriveRequest = {
  action?: "status" | "sync" | "syncAll" | "discover";
  id?: string;
  resolution?: "auto" | "drive" | "studio";
};

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;
  return Response.json({ configured: isDriveConfigured() });
}

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const input = (await request.json()) as DriveRequest;
    if (input.action === "discover") return discoverDocuments();
    if (input.action === "syncAll") return synchronizeAll();

    const document = input.id ? await findDocument(input.id) : undefined;
    if (!document) {
      return Response.json({ error: "That draft could not be found." }, { status: 404 });
    }
    const result = await syncDocument(document, input.resolution || "auto");
    if (result.state !== "conflict") await saveDocument(result.document);
    return Response.json(result, { status: result.state === "conflict" ? 409 : 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Google Docs could not finish syncing." },
      { status: 500 },
    );
  }
}

async function discoverDocuments() {
  const [localDocuments, remoteDocuments] = await Promise.all([
    listDocuments(),
    listDriveDocuments(),
  ]);
  const localByGoogleId = new Map(
    localDocuments.filter((item) => item.googleDocId).map((item) => [item.googleDocId, item]),
  );

  for (const remote of remoteDocuments) {
    const local = localByGoogleId.get(remote.id);
    if (!local) {
      const completeRemote = await getDriveDocument(remote.id);
      const candidate = normalizeIncomingDocument({
        type: "post",
        title: completeRemote.title,
        body: completeRemote.body,
        status: "draft",
      });
      const collision = await findDocument(candidate.id);
      const imported = collision || candidate;
      imported.googleDocId = completeRemote.id;
      imported.driveRevision = completeRemote.revision;
      imported.driveSyncedBody = completeRemote.body.trim();
      if (!collision) imported.body = completeRemote.body.trim();
      await saveDocument(imported);
      continue;
    }

    if (!local.driveSyncedBody) {
      await saveDocument({
        ...local,
        driveRevision: remote.revision,
        driveSyncedBody: local.body.trim(),
      });
    }
  }

  return Response.json({
    documents: (await listDocuments()).map((document) => ({
      ...document,
      isDirty: isDocumentDirty(document),
    })),
  });
}

async function synchronizeAll() {
  const [localDocuments, remoteSummaries] = await Promise.all([
    listDocuments(),
    listDriveDocuments(),
  ]);
  const remoteDocuments = await Promise.all(
    remoteSummaries.map((document) => getDriveDocument(document.id)),
  );
  const localByGoogleId = new Map(
    localDocuments.filter((item) => item.googleDocId).map((item) => [item.googleDocId, item]),
  );
  const results = [];

  for (const remote of remoteDocuments) {
    let local = localByGoogleId.get(remote.id);
    if (!local) {
      const candidate = normalizeIncomingDocument({
        type: "post",
        title: remote.title,
        body: remote.body,
        status: "draft",
      });
      const collision = await findDocument(candidate.id);
      local = collision || candidate;
      local.googleDocId = remote.id;
      local.driveRevision = remote.revision;
      local.driveSyncedBody = remote.body.trim();
      if (!collision) local.body = remote.body.trim();
      await saveDocument(local);
      results.push({ state: collision ? "synced" : "created", document: local });
      continue;
    }

    const result = await syncDocumentWithRemote(local, remote);
    if (result.state !== "conflict") await saveDocument(result.document);
    results.push(result);
  }

  return Response.json({
    results,
    documents: (await listDocuments()).map((document) => ({
      ...document,
      isDirty: isDocumentDirty(document),
    })),
    conflicts: results.filter((result) => result.state === "conflict").length,
  });
}
