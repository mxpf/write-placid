import { env } from "cloudflare:workers";
import { createD1Store, type D1DatabaseLike } from "@mxpf/write-placid-core/studio/d1";
import { mappedGoogleDocId } from "../app/drive-document-map";

export function getD1() {
  if (!env.DB) throw new Error("Write Placid Studio storage is unavailable.");
  return env.DB;
}
export const d1Store = createD1Store({ getD1: () => getD1() as unknown as D1DatabaseLike, mappedGoogleDocId });
export const ensureSchema = d1Store.ensureSchema;
