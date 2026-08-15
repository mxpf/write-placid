# Security

Write Placid separates public reading from private authoring.

- `apps/site` is a static site. Only published Markdown reaches the public build.
- `apps/studio` must sit behind Cloudflare Access. Its D1 database contains drafts and must not be public.
- `apps/drafts-mcp` can save complete drafts, but it cannot publish or delete them. It reaches Studio through a Cloudflare service binding and a shared internal token.
- `apps/trackinghaus` stores daily aggregate counters only. It does not store IP addresses, user agents, cookies, visitor IDs, raw referrers, query strings, or URL fragments.

Never commit `.env`, `.dev.vars`, GitHub tokens, Cloudflare secrets, Google Apps Script secrets, database connection strings, or live D1/KV identifiers. Run `npm run check:config` before publishing a fork.

Please report a vulnerability privately through GitHub Security Advisories rather than a public issue.
