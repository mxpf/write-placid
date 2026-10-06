import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node scripts/serve-static.mjs dist/static-public 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev --prefix ../studio -- --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
