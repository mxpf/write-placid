import { isDocumentDirty } from "../../content";
import { withEditBase } from "../../save-state";
import { syncKdriveRepository } from "../../kdrive-sync";
import { authorizeStudioRequest } from "../../server-auth";
import { listDocuments } from "../../../db/documents";

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    await syncKdriveRepository();
    const items = await listDocuments();
    return Response.json({
      documents: items.map((document) => withEditBase({
        ...document,
        isDirty: isDocumentDirty(document),
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The writing could not be loaded." },
      { status: 500 },
    );
  }
}
