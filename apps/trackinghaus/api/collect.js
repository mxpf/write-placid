import { allowedOrigins, siteKey, timeZone } from "../lib/config.js";
import { ConfigurationError, recordRead } from "../lib/db.js";
import { isoFromDate } from "../lib/dates.js";
import { json, methodNotAllowed, parseBody } from "../lib/http.js";

const sources = new Set(["direct", "search", "social", "referral"]);

function requestOrigin(request) {
  return request.headers?.origin || request.headers?.Origin || "";
}

function originAllowed(origin) {
  if (allowedOrigins().includes(origin)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function setCors(response, origin) {
  if (originAllowed(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader("Vary", "Origin");
}

function cleanPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  const path = value.split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/");
  return path.length <= 240 ? path : null;
}

function cleanTitle(value, path) {
  if (typeof value !== "string") return path;
  const title = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180);
  return title || path;
}

export default async function handler(request, response) {
  const origin = requestOrigin(request);
  setCors(response, origin);

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return methodNotAllowed(response, ["POST", "OPTIONS"]);
  if (!originAllowed(origin)) return json(response, 403, { error: "origin_not_allowed" });

  const contentLength = Number(request.headers?.["content-length"] || 0);
  if (contentLength > 4096) return json(response, 413, { error: "payload_too_large" });

  try {
    const body = parseBody(request);
    const path = cleanPath(body.path);
    if (body.site !== siteKey() || !path || !sources.has(body.source)) {
      return json(response, 400, { error: "invalid_event" });
    }

    await recordRead({
      site: siteKey(),
      day: isoFromDate(new Date(), timeZone()),
      path,
      title: cleanTitle(body.title, path),
      source: body.source,
      returning: body.returning === true,
    });

    return json(response, 202, { ok: true });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return json(response, 503, { error: "storage_not_configured" });
    }
    console.error("trackinghaus_collect_failed", error);
    return json(response, 500, { error: "collection_failed" });
  }
}
