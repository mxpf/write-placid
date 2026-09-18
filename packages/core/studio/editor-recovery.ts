import type { WritingDocument } from "./content.ts";
import { editableSource, withEditBase } from "./save-state.ts";

export function createEditorRecovery(prefix = "write-placid-studio-recovery:") {
const activeKey = `${prefix}active`;
function rememberEdits(storage: Storage, document: WritingDocument) {
  storage.setItem(`${prefix}${document.id}`, JSON.stringify(document));
  storage.setItem(activeKey, document.id);
}
function forgetEdits(storage: Storage, id: string) {
  storage.removeItem(`${prefix}${id}`);
  if (storage.getItem(activeKey) === id) storage.removeItem(activeKey);
}
function lastRecoveredDocument(storage: Storage): WritingDocument | null {
  try {
    const id = storage.getItem(activeKey);
    if (!id) return null;
    const source = storage.getItem(`${prefix}${id}`);
    if (!source) return null;
    const document = JSON.parse(source) as WritingDocument;
    if (document.id !== id) return null;
    if (!["post", "page", "now"].includes(document.type) || typeof document.body !== "string" || typeof document.title !== "string" || (!document.editBase && !id.startsWith("new:"))) return null;
    return document;
  } catch { return null; }
}
function recoverEdits<T extends WritingDocument>(storage: Storage, saved: T): T | null {
  try {
    const source = storage.getItem(`${prefix}${saved.id}`);
    if (!source) return null;
    const value = JSON.parse(source) as WritingDocument;
    if (value.id !== saved.id || value.type !== saved.type || typeof value.body !== "string" || typeof value.title !== "string" || (!value.editBase && !value.id.startsWith("new:"))) return null;
    // A save can reach KDrive without its response reaching this tab. If its
    // writing is already there, use the fresh server baseline, not the old one.
    if (!saved.id.startsWith("new:") && editableSource(value) === editableSource(saved)) {
      forgetEdits(storage, saved.id);
      return null;
    }
    if (value.editBase === editableSource(saved)) {
      return { ...saved, ...value, editBase: withEditBase(saved).editBase, kdriveEtag: saved.kdriveEtag, publishedAt: saved.publishedAt, publicUpdatedAt: saved.publicUpdatedAt };
    }
    return { ...saved, ...value };
  } catch { return null; }
}
return { rememberEdits, forgetEdits, lastRecoveredDocument, recoverEdits };
}

export const { rememberEdits, forgetEdits, lastRecoveredDocument, recoverEdits } = createEditorRecovery();
