const maximumImageBytes = 8 * 1024 * 1024;

const formats = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export function imageContentType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() as keyof typeof formats;
  return formats[extension] || "application/octet-stream";
}

function detectedExtension(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.slice(0, 6)))) return "gif";
  return "";
}

function slugPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "article";
}

export function validateImageUpload(bytes: Uint8Array, articleSlug: string) {
  if (!bytes.length) throw new Error("Choose an image first.");
  if (bytes.length > maximumImageBytes) throw new Error("Images must be smaller than 8 MB.");
  const extension = detectedExtension(bytes);
  if (!extension) throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  const name = `${slugPart(articleSlug)}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  return { name, contentType: formats[extension as keyof typeof formats] };
}

export function validImageName(name: string) {
  return /^[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp|gif)$/i.test(name);
}
