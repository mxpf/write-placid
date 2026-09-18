# KDrive editorial repository and public snapshot contract v1

## Source of truth

KDrive owns document content, identity, public address history, and editorial folders. D1 is a replaceable cache and stores private UI order, Google Docs bridge associations/revisions, last published comparisons, and recovery copies. A normal library read never seeds content from GitHub or falls back to cached article bodies when KDrive is unavailable. Google Docs imports and edits pass through the same KDrive save boundary.

Under `WRITE_PLACID_KDRIVE_ROOT`:

| Folder, recursively | Type | Status |
| --- | --- | --- |
| `Drafts/` | post | draft |
| `Published/` | post | published |
| `Pages/` | page | published |
| `Now/Drafts/` | now | draft |
| `Now/Published/` | now | published |

`Research/` is not editorial content. `Images/` contains private source images. Folder location wins over a conflicting frontmatter status. Subfolders are retained and displayed in Studio; the existing Publish/Move to draft controls move a file between the corresponding roots while preserving its relative subfolder/name. Renaming a KDrive file does not rename its ID, slug, or public snapshot file.

Every managed file has these fields alongside existing title/date/status/source metadata:

```yaml
---
id: "e43e4733-1e15-42af-8550-5fc4eade6fb7"
publicPath: "existing-essay.md"
legacyIds: ["content/posts/existing-essay.md"]
aliases: ["/former-address.html"]
title: "An edited title"
slug: existing-essay
date: 2026-01-01
status: published
---

Article content.
```

Canonical IDs are immutable UUID-v4 values. Migration adopts existing public UUIDs and assigns UUID-v4 values to private drafts. Historical path-shaped IDs remain in private `legacyIds` provenance and resolve old document references; they are neither canonical IDs nor URL aliases and are excluded from public exports. `publicPath` is a bare persistent snapshot filename, such as `existing-essay.md`. Studio derives the validated repository path from the document type; this field is never an unchecked write target. The explicit `slug` determines the `.html` public URL independently of both filenames. A title change never changes the slug. Studio offers a separate slug control and appends the former URL to aliases when it changes. Aliases and slugs are reserved across drafts and published work; `/now.html` and `/index.html` cannot be claimed by posts/pages. Now entries have distinct IDs and slugs but intentionally share `/now.html`.

Frontmatter uses one field per line, with aliases encoded as a JSON array. Duplicate keys and unsupported multiline fields fail closed instead of silently dropping data. Existing scalar extension fields are retained. Normalize unsupported YAML using a backup before migration.

Authoring relationships use `[label](doc:<URI-encoded-ID>)`, optionally followed by a fragment. The link dialog offers a document selector. Source links may use the same scheme. Published content cannot reference private or missing documents. Existing ordinary web/relative links remain unchanged; migration does not rewrite their prose or destinations. Convert relationships that should follow future slug changes using the document selector.

## Validation and writes

Before saving, Studio reads and validates the entire editorial graph. Before publishing, it validates again. Validation covers duplicate IDs, duplicate public slugs/URLs, duplicate or unsafe snapshot filenames, alias collisions, redirect loops, unresolved ID links, and links from published work into drafts. Cached identities additionally detect manually changed IDs, publicPath changes, and removed alias history. Missing formerly published identities block reconciliation; restore them to Drafts rather than deleting their history.

WebDAV writes use strong ETags (`If-Match`); creation uses `If-None-Match: *`. Status changes use `MOVE` with `Overwrite: F`, then verify the moved content/revision before writing. A move can succeed before a later edit fails: reload Studio to see the new folder and retry; the original content remains available. Competing edits fail rather than overwrite. Files lacking a strong ETag cannot be edited safely. Save acknowledgments update the browser revision without losing typing that happened in flight. Stale or missing client revisions, including delayed saves for deleted documents, return a conflict and require a reload.

Never-published drafts can be deleted after a D1 recovery copy is created. Formerly public documents must be moved to Drafts to preserve identity and address reservations. Research and external deletions are not an unpublishing mechanism.

## Public handoff

Authenticated `GET /api/content/snapshot` produces `{manifest, files}` without publishing. The `files` object maps repository-relative filenames to UTF-8 strings. It includes published Markdown and `content/identity-manifest.json`:

```json
{
  "version": 1,
  "documents": [
    {
      "id": "e43e4733-1e15-42af-8550-5fc4eade6fb7",
      "type": "post",
      "slug": "existing-essay",
      "path": "content/posts/existing-essay.md",
      "url": "/existing-essay.html",
      "aliases": ["/former-address.html"]
    }
  ],
  "redirects": {"/former-address.html": "/existing-essay.html"}
}
```

Only published identities and aliases appear in this public manifest. Private content and folder paths are excluded. Each `doc:` link is resolved to the target's current public URL before export, including fragments. Markdown retains IDs and aliases for auditing. The public generator must:

1. Accept v1 and validate manifest IDs, route ownership, aliases, redirect targets, and correspondence with Markdown files. Reject unknown versions.
2. Generate `/<slug>.html` for posts/pages from explicit slugs, independently of snapshot filenames. Preserve `/now.html` as the Now aggregate.
3. Emit redirects from `redirects`, directly to canonical URLs. Hosts supporting response rules should use 301 or 308; the current GitHub Pages deployment uses generated redirect HTML. Do not create aliases as duplicate articles or include them as canonical sitemap entries.
4. Produce all HTML, feeds, navigation, indexes, sitemap entries, redirects, and assets at build time. Require no KDrive credentials or requests at public request time.
5. Rebuild on changes to Markdown or the identity manifest. The contents of a single Git commit are one complete snapshot.

Studio replaces managed Markdown and the manifest in one Git tree/commit, updating the branch without force. Existing code and unrelated repository files are untouched by that publisher. A public Markdown file missing from the canonical graph blocks publishing; only a known canonical document moved to Drafts may be removed. Concurrent Git writes cannot be overwritten. If the resulting tree is unchanged, no commit is created. Referenced KDrive images are copied using the existing asset workflow before that content commit; already-public assets remain valid if no KDrive copy exists.

The manual Publish action and the five-minute scheduler publish the complete validated Published set. Opening Studio only refreshes the cache. Saving within Published can therefore go live at the next scheduled run, as in the previous KDrive integration. Reconciliation reads all documents with at most five simultaneous file reads; large libraries may eventually need a durable indexed validation pipeline. There is no cross-file WebDAV transaction: a concurrent external edit after validation may require the next reconciliation; ETags protect content writes and each exported Git snapshot is internally validated.

## Rollout and migration

Do not deploy this Studio version directly over unmigrated production content. Normal reads deliberately refuse files without persisted identity. Publishing additionally requires `WRITE_PLACID_PUBLIC_CONTRACT_VERSION=1`; absence blocks both content publishing and its image-upload stage.

1. Back up D1, every raw KDrive editorial file, and the pinned public Git snapshot. Enable `WRITE_PLACID_MIGRATION_MODE=1`, disable the public contract flag, and pause cron while reconciling. Do not run old and new writers concurrently.
2. Request authenticated `GET /api/content/migration` and retain its private backup, mapping, differences, `draftIds`, and digest. The bootstrap planner matches documents one-to-one. Existing public bodies, UUIDs, slugs, filenames, metadata, and aliases are authoritative for this one-time reconciliation; KDrive becomes authoritative afterward. It imports public-only documents and preserves private drafts. Ambiguous matches and status conflicts block apply.
3. Explicitly review any status exception using `publicStatusAuthority` (UUID list); do not silently publish a conflicting draft. The GET endpoint accepts repeated `publicStatusAuthority` query parameters. Review the recomputed plan.
4. Apply authenticated `POST /api/content/migration` with `{ "digest": "<reviewed digest>", "backupSaved": true, "draftIds": {"<legacy identity>": "<reviewed UUID>"}, "publicStatusAuthority": [] }`, retaining the exact reviewed values. Writes are conditional and can be resumed with a fresh reviewed plan. The endpoint writes KDrive and D1 without publishing. For a larger library, the same approved plan can be applied through conditional connector writes and a verified cache migration, as in this rollout.
5. Compare all canonical readbacks and the generated snapshot to the approved plan. Deploy and verify the coordinated public consumer. Only then enable `WRITE_PLACID_PUBLIC_CONTRACT_VERSION=1`, publish through Studio, and restore the five-minute schedule. Opening Studio does not publish; a clean published document offers Republish.

New external Markdown needs identity adoption before normal reconciliation. Keep a backup before normalizing unsupported YAML. After bootstrap, GitHub must never replace canonical KDrive content during normal reads or publishing.

`drizzle/0005_editorial_identity.sql` adds only a cache JSON column. `ensureSchema()` also adds it for existing runtime-created databases. Use one mechanism: on a DB already upgraded by the runtime, do not execute the same raw ALTER twice. D1 can be rebuilt from migrated KDrive; private ordering/bridge state and deletion recovery require a D1 backup to restore. To roll back before public contract activation, restore the saved database and KDrive copies and redeploy the previous Studio version; do not run the old filename-based writer against migrated/renamed documents without restoring its matching state.

## Verification

`npm run typecheck`, `npm run lint`, and `npm test` check the build/rendered shell and regression cases for identity, migration, folder moves, ETag conflicts, validation, snapshot resolution, and atomic Git publication. Tests use fake WebDAV/GitHub responses and never mutate real KDrive or public repositories. Production migration, real-server MOVE semantics, and public redirect delivery must be checked during the coordinated rollout.

Protocol references: [WebDAV RFC 4918](https://www.rfc-editor.org/rfc/rfc4918.html), [GitHub Git references API](https://docs.github.com/en/rest/git/refs).
