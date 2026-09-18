import { kdriveConfigured } from "./kdrive";
import { readEditorialRepository } from "./editorial-repository";
import { publishEditorialRepository } from "./editorial-publishing";
import { deleteDocument, listDocuments, cacheDocuments } from "../db/documents";

export async function syncKdriveRepository(options: { publish?: boolean } = {}) {
  if (!kdriveConfigured()) throw new Error("KDrive is unavailable; Studio will not use cached content as the source of truth.");
  const documents = await readEditorialRepository();
  const cached = await listDocuments();
  const ids = new Set(documents.map((document) => document.id));
  const removed = cached.filter((document) => !ids.has(document.id));
  // Missing cache entries never trigger deletion of public content during migration.
  if (removed.some((document) => !document.kdrivePath)) throw new Error("Legacy Studio documents still need migration into KDrive.");
  if (options.publish) await publishEditorialRepository(documents);
  if (!options.publish) {
    await cacheDocuments(documents.filter((document) => {
      const previous = cached.find((item) => item.id === document.id);
      return !previous || previous.kdriveEtag !== document.kdriveEtag || previous.kdrivePath !== document.kdrivePath || previous.status !== document.status;
    }));
  }
  for (const document of removed) await deleteDocument(document.id);
  return { imported: documents.length, published: options.publish ? documents.filter((document) => document.status === "published").length : 0, unpublished: removed.length };
}
