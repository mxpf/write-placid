import { publishEditorialRepository as publishCoreRepository } from "@mxpf/write-placid-core/studio/publishing";
import { cacheDocuments } from "../db/documents";
import type { WritingDocument } from "./content";

export function publishEditorialRepository(documents: WritingDocument[]) {
  return publishCoreRepository(documents, { cacheDocuments });
}
