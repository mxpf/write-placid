# Thinkinghaus parity ledger

These improvements flow back into their canonical Write Placid foundation. This does not change the project chronology or make Thinkinghaus the source of Write Placid.

## Ported source references

### Public site

- `703c5ca`, `fb1ff7b`, `ec75608`: immutable UUID-v4 identities, stable snapshot filenames and slugs, aliases, document-ID links, manifest validation, and redirects.
- `e731bda`: lossless formatted image captions shared by HTML and RSS, including safe links and title escaping.

### Studio

- `f00b496`: KDrive folder-driven identity, migration planning, snapshot contract, and atomic Git publication.
- `854c1ba`: scheduled reconciliation lifecycle records and diagnostics.
- `06d8b3d`, `672beaa`: queued saves, revision acknowledgments, recovery/rebase, navigation safety, and edit conflicts.
- `3d177e6`, `b8a7fc2`, `c4e3981`: image descriptions/captions, safe formatted captions, accessible edit affordance, and selection/focus preservation.
- `ef7b0c1`: fresh KDrive inventory with exact strong-ETag cache reuse, bounded fanout, and no stale fallback.

Personal articles, live IDs, licensed fonts, production URLs, and rollout evidence were not copied. The adaptation uses neutral sample UUIDs, `WRITE_PLACID_*` variables, a configurable Git content root, neutral KDrive defaults, empty Google Docs associations, Instrument Sans, configurable labels, and manual publishing by default.

## Verification checklist

- Identity, manifest, aliases, redirects, and `doc:` links.
- Atomic non-force Git snapshots and public Markdown equivalence.
- Fresh WebDAV inventory, conditional writes/moves, bounded request fanout, and no stale fallback.
- Save queue, retry acknowledgment, recovery baseline, conflicts, navigation, and publication transitions.
- Image validation, descriptions, formatted captions, clean Markdown, and matching public/RSS rendering.
- Scheduler started/completed/failed/skipped records; automatic publication only when configured.
- Site and Studio builds, project Pages paths, feeds, redirects, and Instrument Sans.
- No personal content, licensed font files, secrets, production IDs, or rollout evidence in the package.

## Boundaries and release decision

Trackinghaus remains separately owned and optional. Google Docs and Drafts MCP remain optional inputs and cannot bypass the save/publish contract. KDrive is canonical only when configured; D1 is cache/order/recovery state, never stale content fallback. Base paths remain installation configuration.

Before the first downstream production pin, choose public Git commit installation if repository/CI visibility is sufficient, or an immutable GitHub release attachment containing the verified package artifact. No npm registry is required.
