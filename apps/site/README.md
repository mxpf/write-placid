# Write Placid site

The public, static half of Write Placid.

Edit `site.config.json` and the Markdown under `content/`. Preserve each document’s immutable UUID `id`, stable `publicPath`, explicit `slug`, and retained `aliases`; keep `content/identity-manifest.json` consistent with the published Markdown snapshot. The build validates these fields, aliases, manifest entries, and `doc:` relationships before generating routes and redirects. See the [content identity contract](docs/content-contract.md).

Only posts with `status: published` are included in the normal build. `npm run build:staging` includes drafts for private review.

Published revisions may include an optional `updatedAt` frontmatter value. The article then shows a quiet “Last edited” note; first publications and untouched posts omit it.

Image-title captions may contain the shared safe inline subset: plain text, italics, and links. Studio and the public HTML/RSS renderer use the same escaping and destination rules; see the [caption format](../studio/docs/caption-format.md).

Set `webmentionEndpoint` in `site.config.json` to enable build-time Webmentions. `npm run refresh:webmentions` updates the checked-in cache under `data/`; readers never contact the Webmention provider directly, and a failed refresh leaves the last good cache intact.

`npm run build:static-public` produces `dist/static-public`, a verified static reader without framework hydration or RSC navigation payloads. Configure its early canvas, `color-scheme`, and cross-document View Transition opt-in under `staticPublic` in `site.config.json`. The defaults are neutral white/light. An installation should set its real canvas and scheme so the browser can paint the correct background before the external stylesheet arrives. Motion timings and all visual styling remain in the installation stylesheet; no overlay background is added by the exporter.

```bash
npm install
npm run dev
npm run refresh:webmentions
npm test
```

See the root [operator’s manual](../../docs/SETUP.md) for GitHub Pages, Studio, and Trackinghaus setup.
