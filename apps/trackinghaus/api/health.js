import { databaseConfigured } from "../lib/db.js";
import { emailConfigured } from "../lib/email.js";
import { siteConfigured } from "../lib/config.js";
import { json, methodNotAllowed } from "../lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  return json(response, 200, {
    ok: true,
    configured: {
      database: databaseConfigured(),
      site: siteConfigured(),
      email: emailConfigured(),
    },
  });
}
