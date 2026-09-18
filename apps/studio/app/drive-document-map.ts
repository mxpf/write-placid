/** Optional installation-specific Google Docs associations belong in this map. */
const documentIds: Record<string, string> = {};

export function mappedGoogleDocId(path: string) {
  return documentIds[path] || "";
}
