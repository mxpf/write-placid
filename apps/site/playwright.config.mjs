import { defineConfig } from "@playwright/test";
import { createServer } from "node:net";

async function testPort(variable) {
  // Test workers reload this config and inherit the run's selected ports.
  if (process.env[variable]) return Number(process.env[variable]);
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  process.env[variable] = String(port);
  return port;
}

const sitePort = await testPort("WRITE_PLACID_TEST_SITE_PORT");
const studioPort = await testPort("WRITE_PLACID_TEST_STUDIO_PORT");
const siteUrl = `http://127.0.0.1:${sitePort}`;
const studioUrl = `http://127.0.0.1:${studioPort}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    browserName: "chromium",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "site",
      testMatch: "**/accessibility.spec.mjs",
      use: { baseURL: siteUrl },
    },
    {
      name: "studio",
      testMatch: "**/studio-accessibility.spec.mjs",
      use: { baseURL: studioUrl },
    },
  ],
  webServer: [
    {
      command: `node scripts/serve-static.mjs dist/static-public ${sitePort}`,
      url: siteUrl,
    },
    {
      command: `npm run dev --prefix ../studio -- --host 127.0.0.1 --port ${studioPort} --strictPort`,
      url: studioUrl,
      timeout: 120_000,
    },
  ],
});
