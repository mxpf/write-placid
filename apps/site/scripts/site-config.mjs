import config from "../site.config.json" with { type: "json" };

const deploymentUrl = process.env.WRITE_PLACID_SITE_URL?.trim().replace(/\/+$/, "");

export const siteConfig = {
  ...config,
  url: deploymentUrl || config.url,
};
