import config from "../site.config.json";

const deploymentUrl = process.env.WRITE_PLACID_SITE_URL?.trim().replace(/\/+$/, "");

export const siteConfig = {
  ...config,
  url: deploymentUrl || config.url,
  studioUrl: process.env.WRITE_PLACID_STUDIO_URL?.trim() || config.studioUrl,
};
