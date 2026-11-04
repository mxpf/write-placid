import { authorizeStudioRequest } from "../../../server-auth";
import { livePublicationMatches, publicRevisionForDocument, type PublicPublicationManifest } from "../../../editorial";
import { findDocument } from "../../../../db/documents";
import { studioConfig } from "../../../studio-config";

function livePath(type: "post" | "page" | "now", slug: string) {
  return type === "now" ? "/now.html" : `/${slug}.html`;
}

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const document = url.searchParams.get("id")
    ? await findDocument(String(url.searchParams.get("id")))
    : undefined;
  if (!document) {
    return Response.json({ error: "That piece could not be found." }, { status: 404 });
  }

  const requestedRevision = url.searchParams.get("revision") || "";
  if (document.status === "published" && (!document.publishedRevision || requestedRevision !== document.publishedRevision)) {
    return Response.json({ live: false, error: "The requested publication revision is not the verified Studio revision." }, { status: 409 });
  }

  const liveUrl = new URL(livePath(document.type, document.slug), studioConfig.siteUrl);
  liveUrl.searchParams.set("studio-check", document.updatedAt);
  const publicationUrl = new URL("/write-placid-publication.json", studioConfig.siteUrl);
  publicationUrl.searchParams.set("studio-check", document.updatedAt);
  const [response, publicationResponse] = await Promise.all([
    fetch(liveUrl, { cache: "no-store", redirect: "follow" }),
    fetch(publicationUrl, { cache: "no-store", redirect: "follow" }),
  ]);
  const publication = publicationResponse.ok
    ? await publicationResponse.json() as Partial<PublicPublicationManifest>
    : null;
  const publicRevision = publicRevisionForDocument(publication, document.id);
  if (document.type !== "page" && document.status === "draft") {
    return Response.json({ live: response.status === 404 && !publicRevision, url: liveUrl.toString() });
  }
  return Response.json({
    live: livePublicationMatches(response.ok, publication, document.id, document.publishedRevision),
    url: liveUrl.toString(),
    expectedRevision: document.publishedRevision,
    publicRevision,
  });
}
