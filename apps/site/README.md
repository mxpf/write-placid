# Write Placid site

The public, static half of Write Placid.

Edit `site.config.json` and the Markdown under `content/`. Only posts with `status: published` are included in the normal build. `npm run build:staging` includes drafts for private review.

Published revisions may include an optional `updatedAt` frontmatter value. The article then shows a quiet “Last edited” note; first publications and untouched posts omit it.

Set `webmentionEndpoint` in `site.config.json` to enable build-time Webmentions. `npm run refresh:webmentions` updates the checked-in cache under `data/`; readers never contact the Webmention provider directly, and a failed refresh leaves the last good cache intact.

```text
content/posts/   essays and fragments
content/pages/   About, AI, and Links
content/now/     current and archived /now entries
app/             public pages and presentation
lib/             shared Markdown interpretation
scripts/         content loading and static publishing
site.config.json template identity and optional service settings
site-config.mjs  normalized shared site configuration
```

```bash
npm install
npm run dev
npm run refresh:webmentions
npm test
```

See the root [operator’s manual](../../docs/SETUP.md) for GitHub Pages, Studio, and Trackinghaus setup.
