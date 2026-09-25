# Write Placid Core

Write Placid is the canonical owner of the reusable publishing foundation. Installations such as Thinkinghaus pin an immutable core release and keep their own content, identity, navigation, typography, service bindings, and deployment configuration.

## Version and contract

The package is `@mxpf/write-placid-core`. Version `1.5.0` implements public snapshot contract `1`; both values are exported from the package root. `npm run pack:core` produces a self-contained artifact with ESM JavaScript, declarations, CSS, and source maps. It requires no build or sibling checkout when installed.

Public sites can import `attachScrollFade` from `@mxpf/write-placid-core/scroll-fade`. The controller keeps images fully visible until observation is successfully initialized, preserves the installation's configurable bidirectional viewport fade, respects reduced motion, and restores the safe visible baseline during cleanup. Caption rendering and installation styling remain owned by the consuming site.

The optional `@mxpf/write-placid-core/static-public` build mode turns a completed Vinext static export into a verified reader artifact without framework hydration, RSC payloads, or client-navigation chunks. It preserves semantic HTML, metadata, structured data, ordinary scripts, CSS, assets, RSS, aliases, and instance integrations. The shell emits an early configurable canvas and color scheme plus a synchronous, reduced-motion-aware cross-document transition opt-in. Neutral defaults are white/light; installations own all brand colors, motion CSS, analytics configuration, author controls, content, and typography assets. The browser helper progressively restores typography mutation guards, scroll progress, the shared image fade, and end-of-article footer reveal with configurable selectors and safe no-JavaScript/failure behavior.

Until a permanent release channel is selected, downstream repositories should pin the full Write Placid commit SHA and commit the resulting lockfile. Never use a branch or mutable tag in production. If CI cannot read the repository, attach the verified package artifact to an immutable GitHub release and pin its URL and lockfile integrity.

## Exported surfaces

- Package root: package version and public snapshot contract version.
- `/markdown`: browser-safe inline, image, block, and formatted-caption parsing.
- `/content`: configurable Node readers plus identity, alias, manifest, stable-path, and document-link validation.
- `/site`: deterministic RSS, sitemap, alias redirects, and social metadata from injected configuration. `buildSocialMetadata` selects the first image accepted by the shared Markdown contract for Open Graph and Twitter metadata, including its alt text, or uses the installation-supplied fallback image.
- `/studio/client` and `/studio.css`: shared editor, caption UI, image affordances, save queue, dialogs, and neutral styling. React, React DOM, and Lucide are peer dependencies; fonts and theme overrides remain installation-owned.
- `/studio/content`, `/studio/editorial`, `/studio/save-state`, `/studio/save-queue`, `/studio/editor-recovery`, `/studio/caption-inline`, `/studio/article-images`, `/studio/rich-text`, and `/studio/caption-editor`: reusable primitives with declarations.
- `/studio/github`, `/studio/kdrive`, `/studio/images`, `/studio/publishing`, and `/studio/migration`: server-only storage, atomic snapshot, image, and migration adapters. An explicitly empty `WRITE_PLACID_GITHUB_CONTENT_ROOT` targets the repository root.
- `/studio/repository`: `createEditorialRepository({ listCachedDocuments, loadCanonicalDocuments, saveCanonicalDocument, saveCachedDocument })` returns canonical-first read, editor-save, and incoming-save operations. `EditorialConflictError` is exported at module scope.
- `/studio/d1`: `createD1Store({ getD1, mappedGoogleDocId? })` returns schema initialization, document cache, private ordering, deletion recovery, and cursor operations. `/studio/d1-schema` exposes the matching Drizzle schema for migration tooling. Binding lookup and any private document map are injected by the installation.
- `/studio/drive`: `createDriveBridge({ url, secret, fetch?, validateUrl?, now? })` returns configuration, list/get/create, and three-way synchronization operations without packaging credentials.
- `/studio/reconciliation`: `createRepositoryReconciliation({ isCanonicalConfigured, readEditorialRepository, listCachedDocuments, cacheDocuments, deleteCachedDocument, publishEditorialRepository })` returns the whole-graph reconciliation operation.
- `/studio/scheduler`: `runScheduledReconciliation(controller, { migrationMode, record, logger? }, reconcile)` preserves completion/failure evidence while leaving worker bindings and `waitUntil` local.
- `/studio/reorder` and `/studio/smart-quotes`: editor ordering and typographic helpers.

The package has no personal content, production credentials, deployment IDs, private drafts, licensed fonts, or Thinkinghaus defaults.

## Instance boundary

The installation owns site and author identity, navigation, analytics, assets, font files, theme overrides, repository target/root, authentication, storage credentials, database bindings, cron schedule, and content. Write Placid owns identity rules, snapshot contract, Markdown/caption behavior, editor safety, publishing semantics, and reusable adapters.

Saving and publishing are separate. `WRITE_PLACID_AUTO_PUBLISH=0` is the starter default: saves remain canonical in the editorial repository until the author chooses Publish. Set it to `1` only when an installation explicitly wants scheduled publication. Manual Publish validates and writes the complete snapshot atomically.

## Upgrade and rollback

1. Pin the immutable SHA or release artifact and regenerate the lockfile.
2. Read the changelog and contract/migration notes.
3. Run downstream content, feed, static-export, Studio, and browser-equivalence checks.
4. Back up KDrive and D1 before any declared data migration; use migration mode and dry-run review.
5. Deploy without changing service identity or credentials, then verify the public snapshot and scheduled-run record.

Rollback by restoring the previous package reference and lockfile. If a release changes persisted data, restore the matching KDrive/D1 backups before running the previous writer. Do not run an older path-identity writer against UUID-migrated content.

## Release gate

Run `npm run check`, `npm pack --dry-run`, and the secret/personal-data scan in [PARITY.md](PARITY.md). A release is ready only after Write Placid consumes its package exports and downstream installations pass at the exact candidate commit.
