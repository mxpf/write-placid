import { authorizeStudioRequest } from "../../../server-auth";
import { loadKdriveImage, saveKdriveImage } from "../../../kdrive";
import { validateImageUpload, validImageName } from "../../../image-files";

export async function GET(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  const name = new URL(request.url).searchParams.get("name") || "";
  if (!validImageName(name)) {
    return Response.json({ error: "That image name is invalid." }, { status: 400 });
  }
  const image = await loadKdriveImage(name);
  if (!image) return Response.json({ error: "That image could not be found." }, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const unauthorized = await authorizeStudioRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose an image first." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { name, contentType } = validateImageUpload(bytes, String(form.get("slug") || "article"));
    await saveKdriveImage(name, bytes, contentType);
    return Response.json({
      name,
      src: `/images/${name}`,
      previewUrl: `/api/content/image?name=${encodeURIComponent(name)}`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The image could not be added." },
      { status: 400 },
    );
  }
}
