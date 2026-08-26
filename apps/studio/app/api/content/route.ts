import { isDocumentDirty } from "../../content";
import { loadPublishedDocuments } from "../../github";
import { kdriveConfigured } from "../../kdrive";
import { syncKdriveRepository } from "../../kdrive-sync";
import { authorizeStudioRequest } from "../../server-auth";
import { listDocuments, seedDocuments } from "../../../db/documents";

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    let items = await listDocuments();
    if (!items.length) {
      const published = await loadPublishedDocuments();
      await seedDocuments(published);
    }
    if (kdriveConfigured()) {
      await syncKdriveRepository();
    }
    items = await listDocuments();
    return Response.json({
      documents: items.map((document) => ({
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
