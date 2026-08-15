import { getChatGPTUser } from "./chatgpt-auth";

async function hasValidInternalToken(request: Request) {
  const expected = process.env.WRITE_PLACID_INTERNAL_TOKEN?.trim();
  const received = request.headers.get("x-write-placid-token")?.trim();
  if (!expected || !received) return false;

  const encoder = new TextEncoder();
  const algorithm = { name: "HMAC", hash: "SHA-256" };
  const [expectedKey, receivedKey] = await Promise.all([
    crypto.subtle.importKey("raw", encoder.encode(expected), algorithm, false, ["sign", "verify"]),
    crypto.subtle.importKey("raw", encoder.encode(received), algorithm, false, ["sign"]),
  ]);
  const message = encoder.encode("write-placid-internal-request");
  const receivedSignature = await crypto.subtle.sign(algorithm, receivedKey, message);
  return crypto.subtle.verify(algorithm, expectedKey, receivedSignature, message);
}

export async function authorizeStudioRequest(request: Request) {
  const url = new URL(request.url);
  const isLocal =
    process.env.NODE_ENV === "development" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (await hasValidInternalToken(request)) return null;

  const user = await getChatGPTUser();

  if (!user && !isLocal) {
    return Response.json({ error: "Sign in to use Write Placid Studio." }, { status: 401 });
  }

  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return Response.json({ error: "That request came from somewhere unexpected." }, { status: 403 });
    }
  }

  return null;
}
