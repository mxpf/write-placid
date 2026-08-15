export function siteKey() {
  return process.env.TRACKINGHAUS_SITE_KEY?.trim() || "my-blog";
}

export function siteName() {
  return process.env.TRACKINGHAUS_SITE_NAME?.trim() || "My blog";
}

function normalizedOrigin(value) {
  try {
    const url = new URL(value.trim());
    if (!new Set(["http:", "https:"]).has(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedOrigins() {
  const configured =
    process.env.TRACKINGHAUS_ALLOWED_ORIGINS ||
    process.env.TRACKINGHAUS_ALLOWED_ORIGIN ||
    "";
  return [
    ...new Set(
      configured
        .split(",")
        .map(normalizedOrigin)
        .filter(Boolean),
    ),
  ];
}

export function allowedOrigin() {
  return allowedOrigins()[0] || "";
}

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function siteConfigured() {
  return allowedOrigins().length > 0 && validTimeZone(timeZone());
}

export function timeZone() {
  return process.env.TRACKINGHAUS_TIME_ZONE?.trim() || "UTC";
}

function httpsUrl(hostname) {
  return hostname ? `https://${hostname.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "";
}

export function dashboardUrl() {
  return (
    process.env.TRACKINGHAUS_DASHBOARD_URL?.trim() ||
    httpsUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    httpsUrl(process.env.VERCEL_URL)
  );
}

export function repositoryUrl() {
  const configured = process.env.TRACKINGHAUS_REPOSITORY_URL?.trim();
  if (configured) return configured;

  const provider = process.env.VERCEL_GIT_PROVIDER;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repository = process.env.VERCEL_GIT_REPO_SLUG;
  if (provider === "github" && owner && repository) {
    return `https://github.com/${owner}/${repository}`;
  }
  return "https://github.com/your-name/write-placid";
}
