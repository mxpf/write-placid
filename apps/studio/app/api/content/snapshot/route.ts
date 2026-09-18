import { authorizeStudioRequest } from "../../../server-auth";
import { readEditorialRepository } from "../../../editorial-repository";
import { buildPublicSnapshot } from "../../../editorial";

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;
  try { return Response.json(buildPublicSnapshot(await readEditorialRepository())); }
  catch (error) { return Response.json({ error: String(error) }, { status: 409 }); }
}
