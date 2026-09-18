import { authorizeStudioRequest } from "../../../server-auth";
import { loadKdrivePosts, saveKdrivePost, listKdrivePostRefs, readKdriveSource } from "../../../kdrive";
import { loadPublishedDocuments } from "../../../github";
import { listDocuments, saveDocument, replaceDocument } from "../../../../db/documents";
import { planEditorialMigration } from "../../../editorial-migration";

async function plan(draftIds?: Record<string, string>, publicStatusAuthority?: string[]) {
  const [kdrive, cached, published] = await Promise.all([loadKdrivePosts(), listDocuments(), loadPublishedDocuments()]);
  const migration = planEditorialMigration(kdrive, cached, published, { draftIds, publicStatusAuthority });
  const rawFiles: Record<string, string> = {};
  for (const ref of await listKdrivePostRefs()) rawFiles[`${ref.folder}/${ref.name}`] = await readKdriveSource(ref);
  // Ignore volatile retrieval timestamps when checking the reviewed plan.
  const fingerprint = JSON.stringify(migration.documents.map(({ updatedAt, ...document }) => { void updatedAt; return document; }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  return { ...migration, rawFiles, digest: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("") };
}

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;
  try { return Response.json(await plan(undefined, new URL(request.url).searchParams.getAll("publicStatusAuthority"))); }
  catch (error) { return Response.json({ error: String(error) }, { status: 409 }); }
}

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const input = await request.json() as { digest?: string; backupSaved?: boolean; draftIds?: Record<string, string>; publicStatusAuthority?: string[] };
    const migration = await plan(input.draftIds, input.publicStatusAuthority);
    if (input.digest !== migration.digest || !input.backupSaved) throw new Error("Download and review a fresh migration plan and backup before applying it.");
    if (migration.warnings.length) throw new Error(migration.warnings.join("\n"));
    for (const document of migration.documents) {
      const previous = migration.backup.kdrive.find((item) => item.kdrivePath === document.kdrivePath);
      await saveKdrivePost(document, previous);
      const entry = migration.mapping.find((item) => item.id === document.id)!;
      if (entry.cachedId && entry.cachedId !== document.id) await replaceDocument(entry.cachedId, document);
      else await saveDocument(document);
    }
    return Response.json({ migrated: migration.documents.length, published: false });
  } catch (error) { return Response.json({ error: String(error) }, { status: 409 }); }
}
