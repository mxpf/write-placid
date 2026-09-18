import { referencedLocalImages } from "./article-images.ts";
import type { WritingDocument } from "./content.ts";
import { publishImageAsset } from "./github.ts";
import { loadKdriveImage } from "./kdrive.ts";

export async function publishDocumentImages(document: WritingDocument) {
  const names = [...new Set(referencedLocalImages(document.body))];
  for (const name of names) {
    const image = await loadKdriveImage(name);
    if (image) await publishImageAsset(name, image.bytes);
  }
}
