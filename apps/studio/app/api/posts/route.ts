import { GET as getContent } from "../content/route";

/** Backward-compatible authenticated library view for older Drafts MCP clients. */
export async function GET(request: Request) {
  const response = await getContent(request);
  if (!response.ok) return response;
  const result = await response.json() as { documents?: { type?: string }[] };
  return Response.json({
    posts: (result.documents || []).filter((document) => document.type === "post"),
  });
}
