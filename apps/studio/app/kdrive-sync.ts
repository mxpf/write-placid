import { kdriveConfigured } from "./kdrive";
import { readEditorialRepository } from "./editorial-repository";
import { publishEditorialRepository } from "./editorial-publishing";
import { deleteDocument, listDocuments, cacheDocuments } from "../db/documents";

export const syncKdriveRepository = createRepositoryReconciliation({ isCanonicalConfigured: kdriveConfigured, readEditorialRepository, publishEditorialRepository, deleteCachedDocument: deleteDocument, listCachedDocuments: listDocuments, cacheDocuments });
import { createRepositoryReconciliation } from "@mxpf/write-placid-core/studio/reconciliation";
