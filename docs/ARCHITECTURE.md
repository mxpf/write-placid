# Architecture

```text
AI assistant (optional) ──save only──▶ Drafts MCP
                                         │ service binding + internal token
KDrive (optional) ◀──canonical content──▶ Studio + D1 cache ◀──sync──▶ Google Docs (optional)
                                         │ GitHub Contents API
                                         ▼
                              apps/site/content on main
                                         │ GitHub Actions
                                         ▼
                              Static public site + cached Webmentions
                                         │ aggregate event
                                         ▼
                               Trackinghaus + Neon
```

The Git repository is the public publication record. A publish action atomically writes validated Markdown and `content/identity-manifest.json`; the public workflow validates immutable UUID identities, stable filenames/slugs, aliases, and document-ID links before building.

KDrive is optional. When configured, its editorial folders become canonical for posts, pages, Now entries, and image sources while D1 keeps replaceable cache plus ordering, bridge, and recovery state. Reconciliation uses a fresh inventory, bounded file fanout, and exact strong-ETag cache reuse. Saving never implies publishing; scheduled publication is an explicit configuration choice. Google Docs is a separate optional bridge and does not imply KDrive.

Webmentions are refreshed by the publication workflow and stored in `apps/site/data/webmentions.json`. Rendering uses that local cache, so neither readers nor page requests depend on the external provider.

Trackinghaus is deliberately outside the publishing path. If it is unavailable, the site still works. It counts daily totals by site, path, title, source category, and a browser-local returning flag. It respects Global Privacy Control and Do Not Track.

`apps/trackinghaus` is the version shipped with the template. The standalone Trackinghaus repository is the canonical upstream product; changes are copied here deliberately and generalized before release.
