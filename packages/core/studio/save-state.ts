import { normalizeIncomingDocument, parseWritingDocument, serializeWritingDocument, type WritingDocument } from "./content.ts";

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
    publishedRevision: saved.publishedRevision,
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

const mergeableFields = ["title", "dek", "slug", "date", "status", "body", "source"] as const;

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** True only when expanded preserves every original character in order. */
function isInsertionOnly(original: string, expanded: string) {
  let cursor = 0;
  for (const character of expanded) {
    if (character === original[cursor]) cursor += 1;
  }
  return cursor === original.length;
}

/**
 * Rebase an editor revision only when its changes and the canonical changes
 * touch different author-controlled fields. A body changed on both sides is
 * deliberately left as a conflict rather than guessed at line-by-line.
 */
function rebaseNonOverlappingEdits(input: Partial<WritingDocument>, existing: WritingDocument) {
  if (!input.editBase) return null;
  let base: WritingDocument;
  try {
    base = parseWritingDocument(input.editBase, existing.path);
  } catch {
    return null;
  }
  const merged: Partial<WritingDocument> = { ...input };
  let localChanged = false;
  for (const field of mergeableFields) {
    const before = base[field];
    const local = input[field] ?? (field === "source" ? undefined : before);
    const remote = existing[field];
    const changedLocally = !sameValue(local, before);
    const changedRemotely = !sameValue(remote, before);
    localChanged ||= changedLocally;
    if (changedLocally && changedRemotely && !sameValue(local, remote)) {
      if (field !== "body" || !isInsertionOnly(String(remote), String(local))) return null;
    }
    (merged as Record<string, unknown>)[field] = changedLocally ? local : remote;
  }
  if (!localChanged) return null;
  return { ...merged, editBase: editableSource(existing), kdriveEtag: existing.kdriveEtag };
}

export function planSave(input: Partial<WritingDocument>, existing?: WritingDocument) {
  let candidate = input;
  let document = normalizeIncomingDocument({ ...candidate, ...(existing ? { id: existing.id } : {}) }, existing);
  let alreadySaved = Boolean(existing && editableSource(document) === editableSource(existing));
  let error = alreadySaved ? null : validateSaveRevision(candidate, existing);
  let rebased = false;
  if (error && existing) {
    const merged = rebaseNonOverlappingEdits(input, existing);
    if (merged) {
      candidate = merged;
      document = normalizeIncomingDocument({ ...candidate, id: existing.id }, existing);
      alreadySaved = editableSource(document) === editableSource(existing);
      error = alreadySaved ? null : validateSaveRevision(candidate, existing);
      rebased = !error;
    }
  }
  return { document, alreadySaved, error, rebased };
}
