import { planSave, withEditBase } from "../../../save-state";
import {
  isDocumentDirty,
  type WritingDocument,
} from "../../../content";
import { authorizeStudioRequest } from "../../../server-auth";
import { EditorialConflictError, saveIncomingEditorialDocument } from "../../../editorial-repository";
import { assertValidRepository } from "../../../editorial";
import { kdriveConfigured } from "../../../kdrive";
import { listDocuments, savePrivateDraft } from "../../../../db/documents";

async function saveDemoDraft(input: Partial<WritingDocument>) {
  const documents = await listDocuments();
  const existing = documents.find((item) => item.id === input.id || item.legacyIds?.includes(input.id || ""));
  if (input.type === "page" || (existing && (
    existing.type === "page" || existing.status !== "draft" ||
    existing.publishedAt || existing.publishedSource || existing.remoteSha || existing.publishedRevision
  ))) {
    throw new EditorialConflictError("This Studio only saves private drafts.");
  }

  const { id, type, title, dek, slug, date, body, source, editBase } = input;
  const { document, alreadySaved, error } = planSave(
    { id, type, title, dek, slug, date, body, source, editBase, status: "draft" },
    existing,
  );
  const conflict = "This draft changed since you opened it. Copy your edits before reloading Studio.";
  if (error) throw new EditorialConflictError(existing ? conflict : error);
  if (existing && alreadySaved) return existing;
  assertValidRepository([...documents.filter((item) => item.id !== document.id), document]);
  if (!await savePrivateDraft(document, existing)) {
    throw new EditorialConflictError(existing ? conflict : "The draft list changed. Reload Studio before saving.");
  }
  return document;
}

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const raw = await request.text();
    if (raw.length > 750_000) {
      return Response.json({ error: "That draft is too large to save." }, { status: 413 });
    }
    const input = JSON.parse(raw || "{}") as Partial<WritingDocument>;
    const document = process.env.WRITE_PLACID_STUDIO_D1_PREVIEW === "1" && !kdriveConfigured()
      ? await saveDemoDraft(input)
      : await saveIncomingEditorialDocument(input);
    return Response.json({
      document: withEditBase({ ...document, isDirty: isDocumentDirty(document) }),
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "Saving a Studio document failed.",
      error: error instanceof Error ? error.message : String(error),
    }));
    return Response.json(
      { error: error instanceof Error ? error.message : "The draft could not be saved." },
      { status: error instanceof EditorialConflictError ? 409 : 500 },
    );
  }
}
