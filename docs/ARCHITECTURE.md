# Architecture

```text
AI assistant (optional) ──save only──▶ Drafts MCP
                                         │ service binding + internal token
KDrive (optional) ◀────canonical sync──▶ Studio + D1 ◀────sync────▶ Google Docs (optional)
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

The Git repository is the public publication record. D1 is the default private working library and retains Studio metadata. A publish action writes Markdown under `apps/site/content`; the public workflow builds only documents whose frontmatter says `status: published`.

KDrive is optional. When configured, its `Drafts` and `Published` folders become the canonical post repository while D1 keeps ordering and synchronization state. A five-minute Worker schedule reconciles bounded batches. Google Docs is a separate optional bridge and does not imply KDrive.

Webmentions are refreshed by the publication workflow and stored in `apps/site/data/webmentions.json`. Rendering uses that local cache, so neither readers nor page requests depend on the external provider.

Trackinghaus is deliberately outside the publishing path. If it is unavailable, the site still works. It counts daily totals by site, path, title, source category, and a browser-local returning flag. It respects Global Privacy Control and Do Not Track.

`apps/trackinghaus` is the version shipped with the template. The standalone Trackinghaus repository is the canonical upstream product; changes are copied here deliberately and generalized before release.
