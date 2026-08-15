import assert from "node:assert/strict";
import test from "node:test";
import collect from "../api/collect.js";
import weeklyCron from "../api/cron/weekly.js";
import weekly from "../api/weekly.js";

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

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

test("collector rejects events from an unapproved origin before storage", async () => {
  const response = responseMock();
  await collect(
    {
      method: "POST",
      headers: { origin: "https://example.com" },
      body: {
        site: "my-blog",
        path: "/notes",
        title: "Notes",
        source: "direct",
        returning: false,
      },
    },
    response,
  );
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "origin_not_allowed");
});

test("weekly endpoint is public and reports missing storage directly", async () => {
  await withEnvironment(
    {
      DATABASE_URL: undefined,
      TRACKINGHAUS_ALLOWED_ORIGINS: "https://example.test",
      TRACKINGHAUS_ALLOWED_ORIGIN: undefined,
    },
    async () => {
      const response = responseMock();
      await weekly({ method: "GET", headers: {} }, response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.body.error, "storage_not_configured");
    },
  );
});

test("weekly endpoint reports a missing host site configuration", async () => {
  await withEnvironment(
    {
      TRACKINGHAUS_ALLOWED_ORIGINS: undefined,
      TRACKINGHAUS_ALLOWED_ORIGIN: undefined,
    },
    async () => {
      const response = responseMock();
      await weekly({ method: "GET", headers: {} }, response);
      assert.equal(response.statusCode, 503);
      assert.equal(response.body.error, "site_not_configured");
    },
  );
});

test("collector accepts any explicitly configured host origin", async () => {
  await withEnvironment(
    {
      DATABASE_URL: undefined,
      TRACKINGHAUS_SITE_KEY: "example-blog",
      TRACKINGHAUS_ALLOWED_ORIGINS: "https://example.test, https://www.example.test",
      TRACKINGHAUS_ALLOWED_ORIGIN: undefined,
    },
    async () => {
      const response = responseMock();
      await collect(
        {
          method: "POST",
          headers: { origin: "https://www.example.test" },
          body: {
            site: "example-blog",
            path: "/notes",
            title: "Notes",
            source: "direct",
            returning: false,
          },
        },
        response,
      );
      assert.equal(response.statusCode, 503);
      assert.equal(response.body.error, "storage_not_configured");
    },
  );
});

test("weekly cron exits cleanly when email is not enabled", async () => {
  await withEnvironment(
    {
      RESEND_API_KEY: undefined,
      TRACKINGHAUS_TO_EMAIL: undefined,
      TRACKINGHAUS_FROM_EMAIL: undefined,
    },
    async () => {
      const response = responseMock();
      await weeklyCron({ method: "GET", headers: {} }, response);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { ok: true, skipped: "email_not_configured" });
    },
  );
});
