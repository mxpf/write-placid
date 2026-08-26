import {
  isDocumentDirty,
  normalizeIncomingDocument,
  type WritingDocument,
} from "../../../content";
import { authorizeStudioRequest } from "../../../server-auth";
import { saveKdrivePost } from "../../../kdrive";
import {
  findDocument,
  findDocumentByPath,
  saveDocument,
} from "../../../../db/documents";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const raw = await request.text();
    if (raw.length > 750_000) {
      return Response.json({ error: "That draft is too large to save." }, { status: 413 });
    }
    const input = JSON.parse(raw || "{}") as Partial<WritingDocument>;
    const existing = input.id ? await findDocument(String(input.id)) : undefined;
    const document = normalizeIncomingDocument(input, existing);
    const collision = await findDocumentByPath(document.path);
    if (collision && collision.id !== existing?.id) {
      return Response.json(
        { error: "A piece with that title already exists." },
        { status: 409 },
      );
    }
    await saveKdrivePost(document, existing);
    await saveDocument(document);
    return Response.json({
      document: { ...document, isDirty: isDocumentDirty(document) },
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "Saving a Studio document failed.",
      error: error instanceof Error ? error.message : String(error),
    }));
    return Response.json(
      { error: error instanceof Error ? error.message : "The draft could not be saved." },
      { status: 500 },
    );
  }
}
