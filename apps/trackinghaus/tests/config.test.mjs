import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedOrigin,
  allowedOrigins,
  dashboardUrl,
  repositoryUrl,
  siteConfigured,
  siteKey,
  siteName,
  timeZone,
} from "../lib/config.js";
import { emailConfigured } from "../lib/email.js";

async function withEnvironment(changes, callback) {
  const previous = new Map(
    Object.keys(changes).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("site configuration is neutral until a host origin is supplied", async () => {
  await withEnvironment(
    {
      TRACKINGHAUS_SITE_KEY: undefined,
      TRACKINGHAUS_SITE_NAME: undefined,
      TRACKINGHAUS_ALLOWED_ORIGINS: undefined,
      TRACKINGHAUS_ALLOWED_ORIGIN: undefined,
      TRACKINGHAUS_TIME_ZONE: undefined,
    },
    async () => {
      assert.equal(siteKey(), "my-blog");
      assert.equal(siteName(), "My blog");
      assert.equal(timeZone(), "UTC");
      assert.equal(siteConfigured(), false);
      assert.deepEqual(allowedOrigins(), []);
    },
  );
});

test("multiple configured origins are normalized and de-duplicated", async () => {
  await withEnvironment(
    {
      TRACKINGHAUS_ALLOWED_ORIGINS:
        "https://example.com/, https://www.example.com/path, https://example.com",
      TRACKINGHAUS_ALLOWED_ORIGIN: undefined,
    },
    async () => {
      assert.deepEqual(allowedOrigins(), [
        "https://example.com",
        "https://www.example.com",
      ]);
      assert.equal(allowedOrigin(), "https://example.com");
      assert.equal(siteConfigured(), true);
    },
  );
});

test("deployment links use explicit values and Vercel metadata", async () => {
  await withEnvironment(
    {
      TRACKINGHAUS_DASHBOARD_URL: undefined,
      TRACKINGHAUS_REPOSITORY_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: "my-trackinghaus.vercel.app",
      VERCEL_URL: "preview.vercel.app",
      VERCEL_GIT_PROVIDER: "github",
      VERCEL_GIT_REPO_OWNER: "writer",
      VERCEL_GIT_REPO_SLUG: "my-trackinghaus",
    },
    async () => {
      assert.equal(dashboardUrl(), "https://my-trackinghaus.vercel.app");
      assert.equal(repositoryUrl(), "https://github.com/writer/my-trackinghaus");
    },
  );
});

test("an invalid reporting timezone leaves the site unconfigured", async () => {
  await withEnvironment(
    {
      TRACKINGHAUS_ALLOWED_ORIGINS: "https://example.com",
      TRACKINGHAUS_ALLOWED_ORIGIN: undefined,
      TRACKINGHAUS_TIME_ZONE: "Somewhere/Not-Real",
    },
    async () => {
      assert.equal(siteConfigured(), false);
    },
  );
});

test("weekly email is optional and enabled only with a complete configuration", async () => {
  await withEnvironment(
    {
      RESEND_API_KEY: "resend-test-key",
      TRACKINGHAUS_TO_EMAIL: "writer@example.com",
      TRACKINGHAUS_FROM_EMAIL: "Trackinghaus alpha <stats@example.com>",
      TRACKINGHAUS_DASHBOARD_URL: "https://stats.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
    },
    async () => {
      assert.equal(emailConfigured(), true);
      delete process.env.TRACKINGHAUS_FROM_EMAIL;
      assert.equal(emailConfigured(), false);
    },
  );
});
