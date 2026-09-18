import { createEditorialRepository, EditorialConflictError } from "@mxpf/write-placid-core/studio/repository";
import { loadKdrivePosts, saveKdrivePost } from "./kdrive";
import { listDocuments, saveDocument } from "../db/documents";

const repository = createEditorialRepository({ listCachedDocuments: listDocuments, loadCanonicalDocuments: loadKdrivePosts, saveCanonicalDocument: saveKdrivePost, saveCachedDocument: saveDocument });
export const { readEditorialRepository, saveEditorialDocument, saveIncomingEditorialDocument } = repository;
export { EditorialConflictError };
