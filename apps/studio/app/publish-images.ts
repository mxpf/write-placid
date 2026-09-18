import { referencedLocalImages } from "./article-images";
import type { WritingDocument } from "./content";
import { publishImageAsset } from "./github";
import { loadKdriveImage } from "./kdrive";

export async function publishDocumentImages(document: WritingDocument) {
  const names = [...new Set(referencedLocalImages(document.body))];
  for (const name of names) {
    const image = await loadKdriveImage(name);
    if (image) await publishImageAsset(name, image.bytes);
  }
}
