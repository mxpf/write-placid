import { deleteKdrivePost, kdriveConfigured } from "../../../kdrive";
import { authorizeStudioRequest } from "../../../server-auth";
import { readEditorialRepository } from "../../../editorial-repository";
import { assertValidRepository } from "../../../editorial";
import { deleteDocument, deletePrivateDraft, listDocuments, saveDocument } from "../../../../db/documents";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const input = (await request.json()) as { id?: string };
    const demo = process.env.WRITE_PLACID_STUDIO_D1_PREVIEW === "1" && !kdriveConfigured();
    const repository = demo ? await listDocuments() : await readEditorialRepository();
    const document = repository.find((item) => item.id === input.id);
    if (!document) return Response.json({ error: "That piece could not be found." }, { status: 404 });
    if (document.type === "page") return Response.json({ error: "Pages cannot be deleted here." }, { status: 400 });
    const next = repository.filter((item) => item.id !== document.id);
    assertValidRepository(next);
    // Preserve alias reservations and content by using Drafts for formerly public work.
    if (document.status === "published" || document.publishedAt || document.remoteSha || document.aliases?.length) throw new Error("Move previously published work to Drafts to preserve its identity and URL history.");
    if (demo) {
      if (!await deletePrivateDraft(document)) {
        return Response.json({ error: "This draft changed or has publication history. Reload Studio before deleting it." }, { status: 409 });
      }
    } else {
      await saveDocument(document);
      await deleteDocument(document.id);
      await deleteKdrivePost(document);
    }
    return Response.json({ deleted: { id: document.id, title: document.title }, removedFromGithub: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The piece could not be deleted." }, { status: 500 });
  }
}
