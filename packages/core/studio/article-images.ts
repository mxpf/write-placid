export type ArticleImage = {
  alt: string;
  src: string;
  title?: string;
};

const imagePattern = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"((?:\\.|[^"\\])*)")?\)$/;

export function isSafeImageSrc(src: string) {
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

export function parseArticleImage(value: string): ArticleImage | null {
  const match = value.match(imagePattern);
  if (!match || !isSafeImageSrc(match[2])) return null;
  return { alt: match[1], src: match[2], title: match[3]?.replace(/\\(["\\])/g, "$1") || undefined };
}

export function articleImageMarkdown(image: ArticleImage) {
  const title = image.title ? ` "${image.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : "";
  return `![${image.alt.replace(/]/g, "")}](${image.src}${title})`;
}

export function referencedLocalImages(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => parseArticleImage(block.trim()))
    .filter((image): image is ArticleImage => Boolean(image?.src.startsWith("/images/")))
    .map((image) => image.src.slice("/images/".length))
    .filter((name) => /^[a-z0-9][a-z0-9._-]*$/i.test(name));
}
