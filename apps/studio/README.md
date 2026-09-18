# Write Placid Studio

The private, phone-friendly authoring app for a Write Placid publication.

Studio consumes the versioned `@mxpf/write-placid-core` release for the shared editor, identity rules, repository/save orchestration, storage adapters, reconciliation, and publishing contract. Instance wrappers retain authentication, service bindings, credentials, private document mappings, assets, and deployment configuration.

## How it works

- A basic installation stores writing in D1. With KDrive enabled, KDrive folders instead own editorial content and immutable identity while D1 remains a replaceable cache plus private order, bridge, and recovery state.
- Studio validates the complete repository and publishes Markdown plus `content/identity-manifest.json` to the configured GitHub root in one non-force Git commit.
- Drafts can be reordered on desktop without changing public-site ordering.
- Published revisions receive optional `updatedAt` metadata so the public site can show a quiet “Last edited” note.
- Google Docs synchronization remains optional and detects conflicts when both copies changed.
- KDrive supports `Drafts`, `Published`, `Pages`, `Now/Drafts`, `Now/Published`, and private `Images`, including nested folders. Fresh inventory and strong ETags prevent stale fallback or competing overwrites.
- Saving and publishing are distinct. The starter keeps scheduled auto-publication off; set `WRITE_PLACID_AUTO_PUBLISH=1` only for an installation that explicitly wants the schedule to publish.

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
- `WRITE_PLACID_PUBLIC_CONTRACT_VERSION=1` enables the coordinated identity-manifest publisher after migration verification.
- `WRITE_PLACID_MIGRATION_MODE=1` pauses reconciliation during a reviewed migration; `WRITE_PLACID_AUTO_PUBLISH` controls scheduled publication.
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
