import config from "./site.config.json" with { type: "json" };

function cleanOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSiteUrl(value) {
  return cleanOptionalString(value).replace(/\/+$/, "");
}

function configKey(value) {
  return cleanOptionalString(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const siteConfig = {
  ...config,
  name: cleanOptionalString(config.name),
  description: cleanOptionalString(config.description),
  url: cleanSiteUrl(config.url),
  language: cleanOptionalString(config.language) || "en-US",
  authorName: cleanOptionalString(config.authorName),
  authorUrl: cleanOptionalString(config.authorUrl),
  relMeUrl: cleanOptionalString(config.relMeUrl),
  webmentionEndpoint: cleanOptionalString(config.webmentionEndpoint),
  studioUrl: cleanOptionalString(config.studioUrl),
  statsUrl: cleanOptionalString(config.statsUrl),
  trackingScriptUrl: cleanOptionalString(config.trackingScriptUrl),
  trackingEndpoint: cleanOptionalString(config.trackingEndpoint),
  trackingSiteKey: cleanOptionalString(config.trackingSiteKey),
};

export const SITE_NAME = siteConfig.name;
export const SITE_DESCRIPTION = siteConfig.description;
export const SITE_URL = siteConfig.url;
export const SITE_LANGUAGE = siteConfig.language;
export const RSS_PATH = "/rss.xml";
export const FEED_URL = `${SITE_URL}${RSS_PATH}`;

export const AUTHOR = siteConfig.authorName && siteConfig.authorUrl
  ? {
      name: siteConfig.authorName,
      url: siteConfig.authorUrl,
      relMeUrl: siteConfig.relMeUrl,
    }
  : undefined;

export const STUDIO_URL = siteConfig.studioUrl;
export const REL_ME_URL = siteConfig.relMeUrl;
export const WEBMENTION_ENDPOINT = siteConfig.webmentionEndpoint;

export const TRACKING = {
  dashboardUrl: siteConfig.statsUrl,
  trackerUrl: siteConfig.trackingScriptUrl,
  collectUrl: siteConfig.trackingEndpoint,
  siteKey: siteConfig.trackingSiteKey,
};

export const RSS_GUID_PREFIX = configKey(SITE_NAME) || "write-placid";
