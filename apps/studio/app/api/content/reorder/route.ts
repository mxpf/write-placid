import { authorizeStudioRequest } from "../../../server-auth";
import { reorderDraftDocuments } from "../../../../db/documents";

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const raw = await request.text();
    if (raw.length > 100_000) {
      return Response.json({ error: "That draft order is too large." }, { status: 413 });
    }
    const input = JSON.parse(raw || "{}") as { ids?: unknown };
    if (!Array.isArray(input.ids) || input.ids.some((id) => typeof id !== "string")) {
      return Response.json({ error: "That draft order is invalid." }, { status: 400 });
    }
    await reorderDraftDocuments(input.ids);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The drafts could not be reordered." },
      { status: 500 },
    );
  }
}
