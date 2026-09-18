import { isDocumentDirty } from "../../../content";
import { withEditBase } from "../../../save-state";
import { assertPublicContract } from "../../../github";
import { publishEditorialRepository } from "../../../editorial-publishing";
import { readEditorialRepository } from "../../../editorial-repository";
import { authorizeStudioRequest } from "../../../server-auth";
import { studioConfig } from "../../../studio-config";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;
  try {
    assertPublicContract();
    const input = (await request.json()) as { id?: string };
    const repository = await readEditorialRepository();
    const previous = repository.find((document) => document.id === input.id);
    if (!previous) return Response.json({ error: "Save this piece before publishing it." }, { status: 404 });
    if (!previous.body.trim()) return Response.json({ error: "There is nothing to publish yet." }, { status: 400 });
    await publishEditorialRepository(repository);
    const document = repository.find((item) => item.id === input.id)!;
    return Response.json({ document: withEditBase({ ...document, isDirty: isDocumentDirty(document) }), url: studioConfig.siteUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Publishing did not finish." }, { status: 500 });
  }
}
