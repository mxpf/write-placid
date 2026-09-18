import { withEditBase } from "../../../save-state";
import {
  isDocumentDirty,
  type WritingDocument,
} from "../../../content";
import { authorizeStudioRequest } from "../../../server-auth";
import { EditorialConflictError, saveIncomingEditorialDocument } from "../../../editorial-repository";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const raw = await request.text();
    if (raw.length > 750_000) {
      return Response.json({ error: "That draft is too large to save." }, { status: 413 });
    }
    const input = JSON.parse(raw || "{}") as Partial<WritingDocument>;
    const document = await saveIncomingEditorialDocument(input);
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
