# Write Placid Studio

The private, phone-friendly authoring app for a Write Placid publication.

## How it works

- Studio keeps its private working library and interface metadata in Cloudflare D1.
- It reads published Markdown from `apps/site/content` in the configured GitHub repository and publishes through the GitHub Contents API.
- Drafts can be reordered on desktop without changing public-site ordering.
- Published revisions receive optional `updatedAt` metadata so the public site can show a small “Last edited” note.
- Google Docs synchronization remains optional and detects conflicts when both copies changed.
- KDrive is an optional canonical repository for post Markdown. When configured, Studio reads and writes `Drafts` and `Published` folders and reconciles bounded batches every five minutes.
- Saving never publishes. Publish remains an explicit action; moving a published piece back to Draft removes its public Markdown while preserving the private copy.

KDrive, Google Docs, and the Drafts MCP are independent options. A basic installation needs only D1, GitHub, and Cloudflare Access.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

The local preview can read a public GitHub repository without authentication. Publishing requires `WRITE_PLACID_GITHUB_TOKEN`.

## Configuration

- `WRITE_PLACID_GITHUB_OWNER`, `WRITE_PLACID_GITHUB_REPO`, and `WRITE_PLACID_GITHUB_BRANCH` select the publication repository.
- `WRITE_PLACID_GITHUB_CONTENT_ROOT` defaults to `apps/site`, matching this monorepo.
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
