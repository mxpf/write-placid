import { isDocumentDirty } from "../../content";
import { withEditBase } from "../../save-state";
import { syncKdriveRepository } from "../../kdrive-sync";
import { kdriveConfigured } from "../../kdrive";
import { authorizeStudioRequest } from "../../server-auth";
import { listDocuments } from "../../../db/documents";

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    if (process.env.WRITE_PLACID_STUDIO_D1_PREVIEW !== "1" || kdriveConfigured()) {
      await syncKdriveRepository();
    }
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
