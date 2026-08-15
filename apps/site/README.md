# Write Placid site

The public, static half of Write Placid.

Edit `site.config.json` and the Markdown under `content/`. Only posts with `status: published` are included in the normal build. `npm run build:staging` includes drafts for private review.

```bash
npm install
npm run dev
npm test
```

See the root [operator’s manual](../../docs/SETUP.md) for GitHub Pages, Studio, and Trackinghaus setup.
