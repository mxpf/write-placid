# Write Placid Studio

The private editor for a Write Placid publication. It works on phones too.

Studio uses `@mxpf/write-placid-core` for the shared editor, saving, storage, and publishing rules. This app handles sign-in, service connections, and deployment settings.

## Demo Studio

The demo requires an approved Cloudflare Access sign-in. See the [demo Studio guide](../../README.md#demo-studio) for the link and how to open it from an article's **Edit** link.

Choose **New piece** to create a private draft. Studio saves changes automatically. Wait for **Saved online** before closing the tab. You can reopen the draft in a fresh tab.

To remove a private draft, open it, choose **Delete**, and confirm. Studio removes it from the library and keeps a private recovery copy. Delete does not remove published writing or drafts with publication history.

Publishing is disabled in the demo, so the **Publish** button is hidden. Saving or deleting a private draft does not change the public site.

The demo uses these settings.

- Set `WRITE_PLACID_STUDIO_D1_PREVIEW=1` to save private drafts in D1, with kDrive disconnected.
- Set `WRITE_PLACID_AUTO_PUBLISH=0` to turn off scheduled publishing.
- Leave `WRITE_PLACID_GITHUB_TOKEN` and `WRITE_PLACID_PUBLIC_CONTRACT_VERSION` unset.

Turning off scheduled publishing alone does not disable manual publishing. The [setup guide](../../docs/SETUP.md#3-add-studio) covers the full Studio setup.

## How it works

- The demo stores private drafts in D1. With kDrive connected, Studio keeps writing there and uses D1 for cached data, draft order, sync records, and recovery copies.
- When publishing is enabled, Studio checks all the writing and sends Markdown, `content/identity-manifest.json`, and a public SHA-256 revision index to GitHub in one commit without overwriting its history. It verifies the proposed files and configured branch before reporting a successful publication.
- Drafts can be reordered on desktop without changing public-site ordering.
- Published revisions receive optional `updatedAt` metadata so the public site can show a quiet “Last edited” note.
- An optional one-line dek is authored with the title and survives KDrive, D1 cache state, Drafts MCP revisions, and public snapshots.
- Google Docs synchronization remains optional and detects conflicts when both copies changed.
- KDrive supports `Drafts`, `Published`, `Pages`, `Now/Drafts`, `Now/Published`, and private `Images`, including nested folders. Fresh inventory and strong ETags prevent stale fallback or competing overwrites.
- Saving and publishing are distinct. The starter keeps scheduled auto-publication off; set `WRITE_PLACID_AUTO_PUBLISH=1` only for an installation that explicitly wants the schedule to publish.
- Manual Publish reconciles the exact editor revision against a fresh KDrive read and reports `Live now` only after the deployed revision index matches it.

kDrive, Google Docs, and Drafts MCP are optional. The demo uses D1 and Cloudflare Access. Publishing to your own site also needs GitHub access and the publishing settings below.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

For private drafts with publishing disabled, use the demo settings above. The example file enables `WRITE_PLACID_PUBLIC_CONTRACT_VERSION`, so remove that setting for this mode. Follow the [setup guide](../../docs/SETUP.md#3-add-studio) to configure D1.

## Configuration

- `WRITE_PLACID_GITHUB_OWNER`, `WRITE_PLACID_GITHUB_REPO`, and `WRITE_PLACID_GITHUB_BRANCH` select the publication repository.
- `WRITE_PLACID_GITHUB_CONTENT_ROOT` defaults to `apps/site`, matching this monorepo.
- `WRITE_PLACID_STUDIO_D1_PREVIEW=1` enables private draft storage in D1 when kDrive is disconnected.
- `WRITE_PLACID_PUBLIC_CONTRACT_VERSION=1` enables publishing after migration verification. Publishing also requires `WRITE_PLACID_GITHUB_TOKEN`. Leave both unset for the demo's private draft mode.
- `WRITE_PLACID_MIGRATION_MODE=1` pauses synchronization during a reviewed migration.
- `WRITE_PLACID_AUTO_PUBLISH=0` turns off scheduled publishing. Use `1` only when you want the kDrive schedule to publish automatically.
- `WRITE_PLACID_KDRIVE_*` values enable optional KDrive WebDAV synchronization.
- `WRITE_PLACID_DRIVE_BRIDGE_*` values enable optional Google Docs synchronization.
- `WRITE_PLACID_INTERNAL_TOKEN` authorizes the private Drafts MCP service binding.
- Cloudflare Access uses `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUD`, and `WRITE_PLACID_STUDIO_EMAIL`.

Never commit credentials, live database IDs, private document IDs, or populated environment files.

## Checks and deployment

```bash
npm run lint
npm run typecheck
npm test
npm run types
npm run db:generate
npm run deploy
```

The deploy command builds the app, deploys it with the Cloudflare configuration, and preserves hosted secrets.

See [the editorial contract](docs/editorial-contract.md), [caption format](docs/caption-format.md), and [scheduler diagnostics](docs/scheduler-diagnostics.md) before migrating an existing installation.
