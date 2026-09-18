import path from "node:path";
import { createContentRepository } from "@mxpf/write-placid-core/content";

export * from "@mxpf/write-placid-core/content";

export const projectRoot = path.resolve(import.meta.dirname, "..");
const repository = createContentRepository({ projectRoot });
export const readContentRepository = repository.readContentRepository;
export const readIdentityManifest = repository.readIdentityManifest;
export const readPosts = repository.readPosts;
export const readNowEntries = repository.readNowEntries;
export const readPages = repository.readPages;
