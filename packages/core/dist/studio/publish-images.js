import { referencedLocalImages } from "./article-images.js";
import { publishImageAsset } from "./github.js";
import { loadKdriveImage } from "./kdrive.js";
export async function publishDocumentImages(document) {
    const names = [...new Set(referencedLocalImages(document.body))];
    for (const name of names) {
        const image = await loadKdriveImage(name);
        if (image)
            await publishImageAsset(name, image.bytes);
    }
}
//# sourceMappingURL=publish-images.js.map