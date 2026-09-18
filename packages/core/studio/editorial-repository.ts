import type { WritingDocument } from "./content.ts";
import { assertValidRepository } from "./editorial.ts";
import { editableSource, planSave } from "./save-state.ts";

export type EditorialRepositoryDependencies = {
  listCachedDocuments: () => Promise<WritingDocument[]>;
  loadCanonicalDocuments: (cached: WritingDocument[]) => Promise<WritingDocument[]>;
  saveCanonicalDocument: (document: WritingDocument, previous?: WritingDocument) => Promise<unknown>;
  saveCachedDocument: (document: WritingDocument) => Promise<unknown>;
};

export class EditorialConflictError extends Error {}

/** Canonical-first repository orchestration with immutable identity and URL-history checks. */
export function createEditorialRepository(dependencies: EditorialRepositoryDependencies) {
  async function readEditorialRepository() {
    const cached = await dependencies.listCachedDocuments();
    const canonical = await dependencies.loadCanonicalDocuments(cached);
    const byId = new Map(cached.map((document) => [document.id, document]));
    for (const document of canonical) {
      if (!document.identityPersisted) throw new Error(`Migrate canonical identity before continuing: ${document.kdrivePath}`);
      const previousAtPath = cached.find((item) => item.kdrivePath === document.kdrivePath);
      if (previousAtPath && previousAtPath.id !== document.id) throw new Error(`Immutable ID changed at ${document.kdrivePath}. Restore the original ID.`);
      const previous = byId.get(document.id);
      if (previous) {
        if (previous.path !== document.path) throw new Error(`Snapshot path changed for ${document.id}. Restore publicPath.`);
        const missingAliases = [...(previous.aliases || []), ...(previous.slug !== document.slug ? [`/${previous.slug}.html`] : [])]
          .filter((alias) => !document.aliases?.includes(alias));
        if (missingAliases.length) throw new Error(`Alias history missing for ${document.id}: ${missingAliases.join(", ")}`);
        Object.assign(document, {
          remoteSha: previous.remoteSha,
          publishedSource: previous.publishedSource,
          googleDocId: previous.googleDocId,
          driveRevision: previous.driveRevision,
          driveSyncedBody: previous.driveSyncedBody,
        });
      }
    }
    for (const previous of cached) {
      if ((previous.publishedAt || previous.remoteSha || previous.aliases?.length) && !canonical.some((item) => item.id === previous.id)) {
        throw new Error(`Published identity missing from the canonical repository: ${previous.id}. Restore it to Drafts to retain its URL history.`);
      }
    }
    assertValidRepository(canonical);
    return canonical;
  }

  async function saveEditorialDocument(document: WritingDocument, previous?: WritingDocument) {
    const repository = await readEditorialRepository();
    const current = repository.find((item) => item.id === document.id);
    if (previous && !current) throw new Error("This document moved out of the editorial repository. Reload Studio.");
    if (current && current.kdriveEtag !== previous?.kdriveEtag) {
      if (!previous || editableSource(current) !== editableSource(previous)) throw new Error("This document has different writing in the canonical repository. Copy your edits before reloading to compare versions.");
      document.publicUpdatedAt = current.publicUpdatedAt;
      document.publishedAt = current.publishedAt || document.publishedAt;
    }
    assertValidRepository([...repository.filter((item) => item.id !== document.id), document]);
    await dependencies.saveCanonicalDocument(document, current);
    await dependencies.saveCachedDocument(document);
    return document;
  }

  async function saveIncomingEditorialDocument(input: Partial<WritingDocument>) {
    const repository = await readEditorialRepository();
    const current = repository.find((item) => item.id === input.id || item.legacyIds?.includes(input.id || ""));
    const { document, alreadySaved, error } = planSave(input, current);
    if (current && alreadySaved) {
      await dependencies.saveCachedDocument(current);
      return current;
    }
    if (error) throw new EditorialConflictError(error);
    assertValidRepository([...repository.filter((item) => item.id !== document.id), document]);
    await dependencies.saveCanonicalDocument(document, current);
    await dependencies.saveCachedDocument(document);
    return document;
  }

  return { readEditorialRepository, saveEditorialDocument, saveIncomingEditorialDocument };
}
