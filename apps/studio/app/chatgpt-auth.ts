import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (userId && email) {
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName =
      encodedFullName &&
      requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;

    return {
      userId,
      displayName: fullName ?? email,
      email,
      fullName,
    };
  }

  return getCloudflareAccessUser(requestHeaders);
}

async function getCloudflareAccessUser(requestHeaders: Headers): Promise<ChatGPTUser | null> {
  const token = requestHeaders.get("cf-access-jwt-assertion");
  const teamDomain = process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/, "");
  const audience = process.env.CLOUDFLARE_ACCESS_AUD?.trim();
  if (!token || !teamDomain || !audience) return null;

  try {
    const issuer = teamDomain.startsWith("https://") ? teamDomain : `https://${teamDomain}`;
    const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, keys, { audience, issuer });
    const cloudflareEmail = typeof payload.email === "string" ? payload.email : "";
    const allowedEmail = process.env.WRITE_PLACID_STUDIO_EMAIL?.trim().toLowerCase();
    if (!cloudflareEmail || (allowedEmail && cloudflareEmail.toLowerCase() !== allowedEmail)) {
      return null;
    }
    const subject = typeof payload.sub === "string" ? payload.sub : cloudflareEmail;
    return {
      userId: subject,
      displayName: cloudflareEmail,
      email: cloudflareEmail,
      fullName: null,
    };
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
