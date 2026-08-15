import { displayDate } from "../../../content";
import { authorizeStudioRequest } from "../../../server-auth";
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

  const liveUrl = new URL(livePath(document.type, document.slug), studioConfig.siteUrl);
  liveUrl.searchParams.set("studio-check", document.updatedAt);
  const response = await fetch(liveUrl, { cache: "no-store", redirect: "follow" });
  if (document.type !== "page" && document.status === "draft") {
    return Response.json({ live: response.status === 404, url: liveUrl.toString() });
  }
  const html = response.ok ? await response.text() : "";
  const expectedDate = document.type !== "page" ? displayDate(document.date) : "";
  const live =
    response.ok &&
    html.includes(document.title) &&
    (!expectedDate || html.includes(expectedDate));
  return Response.json({ live, url: liveUrl.toString(), expectedDate });
}
