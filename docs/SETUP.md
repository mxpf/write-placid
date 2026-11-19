# Set up Write Placid

Start with the public site. Add Studio for private editing, Drafts MCP for creating and updating private drafts from an AI assistant, or Trackinghaus for readership counts as needed.

## 1. Make a copy and preview it

On GitHub, choose **Use this template** or fork the repository, then clone your copy. Use Git and Node.js 22 (22.13 or newer), matching the included CI setup. For PowerShell on Windows, follow the [Git Bash setup in the README](../README.md#start-locally).

From the root of your copy, run the setup and start the Site preview.

```bash
npm run setup
npm run dev:site
```

Open the local URL printed in the terminal. Use the app’s example file to make an ignored local environment file. Put hosted tokens and passwords in your hosting service’s secret settings.

## 2. Publish the public site

1. Set `name`, `description`, and `url` in [`apps/site/site.config.json`](../apps/site/site.config.json). Replace the sample Markdown in [`apps/site/content`](../apps/site/content). Essays go in `posts`, standalone pages in `pages`, and `/now` updates in `now`. Follow the [content guide](../apps/site/docs/content-contract.md) to keep page links and document IDs working.
2. In the [Publish site workflow](../.github/workflows/publish-site.yml), set `PAGES_BASE_PATH` and `NEXT_PUBLIC_PAGES_BASE_PATH` to the path where your site will live, such as `/my-publication`. Set both to `""` for a site at the root of a domain. Set `WRITE_PLACID_SITE_URL` to the full public URL, including the path if there is one. The workflow uses this URL in place of `site.config.json`’s `url` during the build.
3. Push to `main` or run **Publish site** from the **Actions** tab. The workflow runs the checks and writes the built site to `gh-pages`. It also runs daily to refresh Webmentions if you set `webmentionEndpoint`.
4. In **Settings → Pages**, choose **Deploy from a branch** and select `gh-pages` with `/(root)`. Check that Pages has deployed the branch before opening the site. If the branch updates but the site doesn’t, follow [GitHub’s branch publishing troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#troubleshooting-publishing-from-a-branch).

If you assign a custom domain to this repository, configure it in Pages settings and keep a [`CNAME` file](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) with the hostname in `apps/site/public` so it stays in the built site. For a project served under an existing profile site’s domain, keep the project’s path in the workflow and let it [inherit the domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-a-custom-domain-across-multiple-repositories). Turn on [Enforce HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https) in the project’s Pages settings.

## 3. Add Studio

Studio is a private editor on Cloudflare Workers. It uses Cloudflare Access for sign-in. The demo stores private drafts in D1.

The hosted demo lets approved users create a piece, wait for **Saved online**, and reopen it in a fresh tab. **Delete** removes a private draft from the library and keeps a private recovery copy. Publishing is disabled and **Publish** is hidden. [Open the demo Studio](https://write-placid-studio.maxpfennighaus.workers.dev/).

Use **Optional dek** below the title to add a one-line summary. Studio joins line breaks into one line and saves the summary with the private draft. You can reopen and edit it later, or leave it empty. Editing a summary does not publish the draft.

For a setup like the demo, set `WRITE_PLACID_STUDIO_D1_PREVIEW` to `1` and `WRITE_PLACID_AUTO_PUBLISH` to `0`, with kDrive disconnected. Keep `WRITE_PLACID_GITHUB_TOKEN` and `WRITE_PLACID_PUBLIC_CONTRACT_VERSION` unset so publishing stays disabled.

To preview Studio locally, copy [`apps/studio/.env.example`](../apps/studio/.env.example) to `apps/studio/.env.local`. Set `NEXT_PUBLIC_SITE_URL` to the address printed by `npm run dev:site`. From the repository root, run `npm run dev:studio` and open the address it prints.

To set up your own hosted Studio, work from `apps/studio`. Sign in to Wrangler and create a database.

```bash
npx wrangler login
npx wrangler d1 create write-placid-studio
```

Replace the placeholder database ID in `wrangler.cloudflare.jsonc` with the ID Wrangler returns. Keep the populated config out of public Git. Set up the tables in the new hosted database with the included migrations.

```bash
npx wrangler d1 migrations apply write-placid-studio --remote --config wrangler.cloudflare.jsonc
```

Create a [Cloudflare Access application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) for the Studio hostname and allow your email address. Add the following values to the Worker as secrets. From `apps/studio`, use `npx wrangler secret put NAME --config wrangler.cloudflare.jsonc`, replacing `NAME` with each setting.

| Secret | What to put in it |
| --- | --- |
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Your Access team URL |
| `CLOUDFLARE_ACCESS_AUD` | The audience tag for the Studio application |
| `WRITE_PLACID_STUDIO_EMAIL` | The email allowed to use Studio |
| `WRITE_PLACID_GITHUB_TOKEN` | For publishing, a fine-grained token limited to your publication repository with read and write access to Contents |
| `WRITE_PLACID_INTERNAL_TOKEN` | A separate random value. Use it for the Drafts MCP connection if you add that app. |

Set these as Worker variables. The [Studio example file](../apps/studio/.env.example) lists the names and sample values.

| Setting | What to put in it |
| --- | --- |
| `NEXT_PUBLIC_PUBLICATION_NAME` | The name of your publication |
| `NEXT_PUBLIC_SITE_URL` | The full URL of your public site, including any path such as `/my-publication/` |
| `WRITE_PLACID_GITHUB_OWNER` and `WRITE_PLACID_GITHUB_REPO` | The owner and name of your publication repository |
| `WRITE_PLACID_GITHUB_BRANCH` | `main` for the included Pages workflow |
| `WRITE_PLACID_GITHUB_CONTENT_ROOT` | `apps/site` for this repository |
| `WRITE_PLACID_STUDIO_D1_PREVIEW` | `1` for private draft storage in D1 with kDrive disconnected, as in the demo |
| `WRITE_PLACID_AUTO_PUBLISH` | `0` turns off scheduled publishing. Use `1` only when you want the kDrive schedule to publish automatically. |

From `apps/studio`, generate Worker types and deploy.

```bash
npm run types
npm run deploy
```

For a Studio that will publish to your own site, set the Worker variable `WRITE_PLACID_PUBLIC_CONTRACT_VERSION` to `1` once Site and Studio are deployed. Studio needs this setting and the GitHub token to publish. If you’re moving an existing library to kDrive, follow the migration steps below first.

Set `studioUrl` in `apps/site/site.config.json` to the protected Studio URL and republish the site. Open the public site with `#edit` at the end of its address to show edit links in that browser. Add `#edit-off` to hide them again.

The included Pages workflow also accepts a `WRITE_PLACID_STUDIO_URL` repository variable for the Studio address used by **Edit** links.

### Use kDrive for writing storage

If you already have writing in Studio or on the public site, back up D1, kDrive, and Git before switching storage. Follow the [migration guide](../apps/studio/docs/editorial-contract.md) to review and verify the move before enabling publishing.

Create `Drafts`, `Published`, `Pages`, `Now/Drafts`, `Now/Published`, and `Images` under a private kDrive folder. Set `WRITE_PLACID_KDRIVE_WEBDAV_URL`, `WRITE_PLACID_KDRIVE_USERNAME`, and `WRITE_PLACID_KDRIVE_ROOT` in the Worker, and add your application password as the `WRITE_PLACID_KDRIVE_APP_PASSWORD` secret. Keep private connection details out of Git.

With kDrive connected, Studio keeps your writing there and uses D1 for cached data, draft order, sync records, and recovery copies.

### Sync with Google Docs

Follow the [Google Docs setup guide](../apps/studio/google-apps-script/README.md) to deploy the Apps Script. Add its URL as `WRITE_PLACID_DRIVE_BRIDGE_URL` and store the same bridge secret in Apps Script and in Studio’s `WRITE_PLACID_DRIVE_BRIDGE_SECRET`.

## 4. Add Trackinghaus

1. Import your repository into Vercel and set the project’s [root directory](https://vercel.com/docs/monorepos) to `apps/trackinghaus`.
2. Create a Neon Postgres database, run [`apps/trackinghaus/db/schema.sql`](../apps/trackinghaus/db/schema.sql) once, and add the connection string as `DATABASE_URL` in Vercel.
3. Set `TRACKINGHAUS_SITE_KEY`, `TRACKINGHAUS_SITE_NAME`, and `TRACKINGHAUS_ALLOWED_ORIGINS` in Vercel. For a site at `https://example.com/my-publication/`, use `https://example.com` as the allowed origin. The [Trackinghaus example file](../apps/trackinghaus/.env.example) also lists settings for the time zone and optional weekly email.
4. Deploy Trackinghaus, then add its URLs to `apps/site/site.config.json` and republish the site. Use the same `trackingSiteKey` as `TRACKINGHAUS_SITE_KEY` in Vercel.

```json
{
  "statsUrl": "https://your-trackinghaus.vercel.app",
  "trackingScriptUrl": "https://your-trackinghaus.vercel.app/tracker.js",
  "trackingEndpoint": "https://your-trackinghaus.vercel.app/api/collect",
  "trackingSiteKey": "your-site-key"
}
```

## 5. Add Drafts MCP

Drafts MCP lets a compatible AI assistant create and update private drafts in Studio. The tool cannot publish or delete writing, or update pieces with publication history.

### Use the demo Drafts MCP

Add [the demo Drafts MCP address](https://write-placid-drafts-mcp.maxpfennighaus.workers.dev/mcp) to your compatible AI assistant, then sign in with the approved Cloudflare Access account and approve the connection. The demo has its own Worker, sign-in app, storage, and credentials. It connects only to the demo Studio.

Use `save_write_placid_draft` with a title and the complete body in Markdown. Send the whole draft rather than a patch or excerpt.

Include `dek` to set or replace the one-line summary. Omit `dek` on a later update to keep the saved summary, including changes made in Studio. Send `dek: ""` to clear it.

To update a private draft, send its exact `slug` or `current_title` along with the complete revised body. To rename it, put the new name in `title`. Studio keeps the draft's identity, so the update changes the same draft. If several pieces share a title, use the slug. A missing draft or conflicting title and slug returns an error.

Studio checks for competing edits before saving. If it reports a conflict, reopen the draft and compare the writing before trying again. You can reopen a saved draft in a fresh Studio tab. To remove it, use Studio's **Delete** button, which keeps a private recovery copy.

Keep the [demo Studio settings](#3-add-studio) in place. Publishing stays disabled and **Publish** stays hidden.

### Set up your own connection

Deploy Drafts MCP in the same Cloudflare account as your Studio so the Workers can connect directly. Give each installation its own Worker, sign-in app, OAuth storage, and credentials.

From `apps/drafts-mcp`, create a separate Workers KV namespace for the connection.

```bash
npx wrangler kv namespace create OAUTH_KV
```

Choose a Worker name for your connection in `wrangler.jsonc`, replace the placeholder KV ID, and set the `STUDIO` binding’s `service` to your deployed Studio Worker name. Keep the populated config out of public Git.

Create a [Cloudflare Access OIDC application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/saas-apps/generic-oidc-saas/) for Drafts MCP. Use the Drafts MCP public URL with `/callback` appended as the redirect URL. Allow your email address and include the `openid`, `email`, and `profile` scopes.

Use `npx wrangler secret put NAME` to add each value to the Worker. The [example file](../apps/drafts-mcp/.dev.vars.example) lists the setting names.

- Use the `ACCESS_*` settings for the client ID, client secret, authorization URL, token URL, and public keys URL.
- Set `ALLOWED_EMAIL` to your email and generate a separate random value for `COOKIE_ENCRYPTION_KEY`.
- Set `STUDIO_API_TOKEN` to the same value as Studio’s `WRITE_PLACID_INTERNAL_TOKEN`. Keep this value unique to that Studio and Drafts MCP connection.

```bash
npm run cf-typegen
npm run deploy
```

Use the deployed Drafts MCP URL with `/mcp` appended in your compatible AI assistant, then sign in and approve the connection. The [Drafts MCP README](../apps/drafts-mcp/README.md) explains the draft fields and save checks.

## 6. Check the setup

From the repository root, install Chromium for the browser checks and run the project checks and Site lint. These commands work in PowerShell on Windows and in the default shell on macOS and Linux. Browser tests choose their own local ports, so other previews can stay open.

```bash
npm exec --prefix apps/site -- playwright install chromium
npm run check
npm run lint --prefix apps/site
```

Open the public homepage, an article, and the RSS feed over HTTPS. If you added Studio, sign in, save a private draft with a one-line summary, and reopen it in a fresh tab. Check that the writing and summary are both saved. With the demo's settings, **Publish** stays hidden. Check that **Delete** removes the draft and keeps a private recovery copy. If publishing is enabled for your own site, verify the article and feed after a test publication.

If you added Drafts MCP, create a private draft with a summary through your assistant. Update the body using its slug and the complete revised body, leaving `dek` out. Reopen Studio in a fresh tab and confirm there is one draft with the updated writing and the same summary. Then include a new `dek` in another complete update and check that the summary changes. With the demo's settings, **Publish** stays hidden.

If you added Trackinghaus, confirm the dashboard shows page-view counts for your publication.

## Upgrade to 1.7.1

[Core 1.7.1](https://github.com/mxpf/write-placid/releases/tag/v1.7.1) is a maintenance release with updated Studio icons, lint tools, and TypeScript 7. Read the [release notes](releases/v1.7.1.md) before updating. Writing and private drafts keep their existing format, and public snapshot contract `1` is unchanged.

Back up your writing and private recovery data first, including D1 and kDrive if you use them. Keep your site's content, identity, credentials, storage connections, and publishing settings in place.

If your site uses `@mxpf/write-placid-core` as a dependency, update Site and Studio together. Use the verified [1.7.1 package](https://github.com/mxpf/write-placid/releases/download/v1.7.1/mxpf-write-placid-core-1.7.1.tgz), pinned to that release URL, and commit the updated lockfiles. The release includes [SHA256SUMS.txt](https://github.com/mxpf/write-placid/releases/download/v1.7.1/SHA256SUMS.txt) so you can check the download. The template's own apps use the core from this repository; keep that local dependency when updating a copy of the template.

If you are moving from a version before 1.7.0, the [1.7.0 upgrade notes](releases/v1.7.0.md#upgrading-an-existing-installation) describe the Publish requests and document fields needed by custom Studio clients.

The supplied commands run TypeScript 7.0.2 for all three apps' type checks and the core build. Site and Studio install it as `typescript-compiler`; their `typescript` dependency provides Microsoft's TypeScript 6 compatibility API for lint tools. Keep both aliases when updating the tools. Drafts MCP uses TypeScript 7 directly. Site's Node types and CI runtime stay on Node 22.

Run the [setup checks](#6-check-the-setup) and your site's [core upgrade checks](CORE.md#upgrade-and-rollback) before deploying. Verify private draft saves, summaries, and reopening in a fresh tab. Test publication only on a site where you have chosen to enable it.

The demo keeps publishing disabled and **Publish** hidden. The GitHub release provides a package to install; it does not deploy it to your site or publish any writing.
