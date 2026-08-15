import { deleteGithubDocument } from "../../../github";
import { authorizeStudioRequest } from "../../../server-auth";
import { deleteDocument, findDocument } from "../../../../db/documents";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const input = (await request.json()) as { id?: string };
    const document = input.id ? await findDocument(input.id) : undefined;
    if (!document) {
      return Response.json({ error: "That piece could not be found." }, { status: 404 });
    }
    if (document.type === "page") {
      return Response.json({ error: "Pages cannot be deleted here." }, { status: 400 });
    }

    const removedFromGithub = await deleteGithubDocument(document);
    await deleteDocument(document.id);
    return Response.json({
      deleted: { id: document.id, title: document.title },
      removedFromGithub,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The piece could not be deleted." },
      { status: 500 },
    );
  }
}
