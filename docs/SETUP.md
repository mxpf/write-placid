# Write Placid operator’s manual

Start with the public site. Add Studio and Trackinghaus only if you need them.

## 1. Make the repository yours

Use GitHub’s **Use this template** button, or fork the repository. Keep it private while entering credentials; the finished code can be public because credentials remain in host secrets.

Run:

```bash
npm run setup
npm run check:config
```

## 2. Configure and publish the site

Edit `apps/site/site.config.json`. At minimum, change `name`, `description`, and `url`. Optional author fields add person metadata and a `rel=me` link. Set `webmentionEndpoint` only if you want cached Webmentions. Replace the sample Markdown in:

- `apps/site/content/posts`
- `apps/site/content/pages`
- `apps/site/content/now`

The included GitHub Actions workflow builds `apps/site` and publishes its static export to the `gh-pages` branch on each push to `main`. It also runs daily so an enabled Webmention cache can refresh without a content change. A temporary Webmention failure does not block publication. In repository settings, set Pages to deploy from the `gh-pages` branch. The workflow’s `PAGES_BASE_PATH` values default to `/write-placid` for this template repository; change them to your repository path, or to an empty value when deploying at the root of a custom domain. Add a `CNAME` file under `apps/site/public` only when using a custom domain.

## 3. Add the private Studio

Studio runs on Cloudflare Workers, uses D1, and should be protected by Cloudflare Access.

```bash
cd apps/studio
npx wrangler login
npx wrangler d1 create write-placid-studio
```

Copy the returned database ID into `wrangler.cloudflare.jsonc`, replacing the all-zero placeholder. Then apply the migrations:

```bash
npx wrangler d1 migrations apply write-placid-studio --remote --config wrangler.cloudflare.jsonc
```

Copy `.env.example` to `.env.local` for local development. For production, add every sensitive value with `npx wrangler secret put NAME --config wrangler.cloudflare.jsonc`. Use a fine-grained GitHub token limited to your publication repository with **Contents: read and write**.

Create a Cloudflare Access self-hosted application for the Studio Worker and restrict it to your email. Set `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUD`, and `WRITE_PLACID_STUDIO_EMAIL` as Worker secrets. Generate `WRITE_PLACID_INTERNAL_TOKEN` with `openssl rand -hex 32` even if you are not using the Drafts MCP yet.

Set `NEXT_PUBLIC_PUBLICATION_NAME` and `NEXT_PUBLIC_SITE_URL` as non-secret Worker variables, then:

```bash
npm run types
npm run deploy
```

Keep `WRITE_PLACID_GITHUB_CONTENT_ROOT=apps/site` for this monorepo. Studio uses logical document paths such as `content/posts/example.md` internally and adds that repository prefix only at the GitHub boundary.

Return to `apps/site/site.config.json` and set `studioUrl` to the protected Worker URL. Visiting the public site with `#edit` once enables private edit links in that browser; `#edit-off` removes them.

### Optional Google Docs sync

Follow `apps/studio/google-apps-script/README.md`. The bridge secret belongs in both Apps Script properties and `WRITE_PLACID_DRIVE_BRIDGE_SECRET`.

### Optional KDrive repository

Create `Drafts` and `Published` folders under a private KDrive root. Configure `WRITE_PLACID_KDRIVE_WEBDAV_URL`, `WRITE_PLACID_KDRIVE_USERNAME`, and `WRITE_PLACID_KDRIVE_ROOT` as Worker variables, then add the KDrive application password as the `WRITE_PLACID_KDRIVE_APP_PASSWORD` Worker secret. Do not commit a live username, URL, password, or private path.

When all four KDrive values are present, Studio saves post Markdown there and the Worker reconciles up to five remote files every five minutes. Files moved into `Published` are published through GitHub; files moved back into `Drafts` are removed from the public content tree. Pages and `/now` entries remain in D1/GitHub. Leave the KDrive values empty to keep D1 as the private canonical library.

## 4. Add Trackinghaus

Import this repository into Vercel and set the project’s root directory to `apps/trackinghaus`. Provision a Neon Postgres database and run `apps/trackinghaus/db/schema.sql` once.

Copy `apps/trackinghaus/.env.example` into Vercel’s environment variables. The required values identify one publication and its allowed origins. Resend settings are optional and only power the weekly email.

After deployment, put the dashboard URL and tracker URLs into `apps/site/site.config.json`:

```json
{
  "statsUrl": "https://your-trackinghaus.vercel.app",
  "trackingScriptUrl": "https://your-trackinghaus.vercel.app/tracker.js",
  "trackingEndpoint": "https://your-trackinghaus.vercel.app/api/collect",
  "trackingSiteKey": "your-site-key"
}
```

## 5. Add the Drafts MCP

This is optional. It requires the Studio and must run in the same Cloudflare account so its `STUDIO` service binding can reach the Studio Worker without public HTTP.

```bash
cd apps/drafts-mcp
npx wrangler kv namespace create OAUTH_KV
```

Replace the all-zero KV ID in `wrangler.jsonc`. Confirm the service name matches the deployed Studio Worker. Set the Access OAuth values, `COOKIE_ENCRYPTION_KEY`, `ALLOWED_EMAIL`, and `STUDIO_API_TOKEN` with `wrangler secret put`; the last value must equal Studio’s `WRITE_PLACID_INTERNAL_TOKEN`.

Run `npm run cf-typegen`, then deploy. The exposed tool saves complete drafts and revisions only.

## 6. Verify before sharing

From the repository root:

```bash
npm run check
```

Also verify one complete path manually: create a draft in Studio, publish it, wait for GitHub Pages, open the live article, check RSS, and confirm Trackinghaus receives only an aggregate count.
