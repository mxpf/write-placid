import { normalizeIncomingDocument, serializeWritingDocument, type WritingDocument } from "./content.ts";

/** Publishing timestamps are server-owned and are not competing author edits. */
export function editableSource(document: WritingDocument) {
  return serializeWritingDocument({ ...document, publishedAt: "", publicUpdatedAt: "" });
}

export function withEditBase<T extends WritingDocument>(document: T): T {
  return { ...document, editBase: editableSource(document) };
}

/** Carry server revisions into the next save while preserving edits typed in flight. */
export function acknowledgeSave<T extends WritingDocument>(latest: T, saving: T, saved: T): T {
  return {
    ...latest,
    id: saved.id,
    editBase: saved.editBase,
    path: saved.path,
    publicPath: saved.publicPath,
    slug: latest.slug === saving.slug ? saved.slug : latest.slug,
    legacyIds: saved.legacyIds,
    aliases: saved.aliases,
    kdrivePath: saved.kdrivePath,
    kdriveEtag: saved.kdriveEtag,
    identityPersisted: saved.identityPersisted,
    remoteSha: saved.remoteSha,
    publishedSource: saved.publishedSource,
    publishedAt: saved.publishedAt,
    publicUpdatedAt: saved.publicUpdatedAt,
    updatedAt: saved.updatedAt,
  };
}

export function validateSaveRevision(input: Partial<WritingDocument>, existing?: WritingDocument) {
  if (input.id && !input.id.startsWith("new:") && !existing) return "This piece no longer exists. Reload Studio before saving.";
  if (existing && input.editBase !== undefined) {
    if (input.editBase !== editableSource(existing)) return "This piece has different writing in KDrive. Your edits are still in this tab. Copy them before reloading to compare versions.";
  } else if (existing && (!input.kdriveEtag || input.kdriveEtag !== existing.kdriveEtag)) return "This piece changed since you opened it. Copy your edits before reloading Studio.";
  return null;
}

export function planSave(input: Partial<WritingDocument>, existing?: WritingDocument) {
  const document = normalizeIncomingDocument({ ...input, ...(existing ? { id: existing.id } : {}) }, existing);
  const alreadySaved = Boolean(existing && editableSource(document) === editableSource(existing));
  return { document, alreadySaved, error: alreadySaved ? null : validateSaveRevision(input, existing) };
}
