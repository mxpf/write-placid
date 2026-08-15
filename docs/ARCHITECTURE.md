# Architecture

```text
AI assistant (optional) ──save only──▶ Drafts MCP
                                         │ service binding
Google Docs (optional) ◀────sync────▶ Studio + D1
                                         │ GitHub Contents API
                                         ▼
                                  Markdown on main
                                         │ GitHub Actions
                                         ▼
                                      Public site
                                         │ aggregate event
                                         ▼
                               Trackinghaus + Neon
```

The Git repository is the publication record. D1 is the private working library. A publish action writes Markdown to GitHub; the public workflow builds only documents whose frontmatter says `status: published`.

Trackinghaus is deliberately outside the publishing path. If it is unavailable, the site still works. It counts daily totals by site, path, title, source category, and a browser-local returning flag. It respects Global Privacy Control and Do Not Track.
