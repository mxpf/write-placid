import { isDocumentDirty, markRevisedPost } from "../../../content";
import { publishDocument } from "../../../github";
import { saveKdrivePost } from "../../../kdrive";
import { authorizeStudioRequest } from "../../../server-auth";
import { findDocument, replaceDocument, saveDocument } from "../../../../db/documents";
import { studioConfig } from "../../../studio-config";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const input = (await request.json()) as { id?: string };
    let document = input.id ? await findDocument(input.id) : undefined;
    if (!document) {
      return Response.json({ error: "Save this piece before publishing it." }, { status: 404 });
    }
    if (!document.body.trim()) {
      return Response.json({ error: "There is nothing to publish yet." }, { status: 400 });
    }
    if (document.type !== "page" && document.status === "published" && !document.publishedAt) {
      document.publishedAt = new Date().toISOString();
    }
    document = markRevisedPost(document);
    const published = await publishDocument(document);
    await saveKdrivePost(published, document);
    if (published.id !== document.id) {
      await replaceDocument(document.id, published);
    } else {
      await saveDocument(published);
    }
    return Response.json({
      document: { ...published, isDirty: isDocumentDirty(published) },
      url: studioConfig.siteUrl,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Publishing did not finish." },
      { status: 500 },
    );
  }
}
