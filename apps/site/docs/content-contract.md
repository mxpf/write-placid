# Write Placid content identity contract

The Markdown document is the portable publishing manifest shared by Studio, KDrive, and the public build. Its body and identity travel together. KDrive folders may describe editorial state or grouping, but a folder name or file path is never a public identity.

## Required frontmatter

Every post, page, and Now entry carries:

```yaml
id: 46940085-c1e7-4be0-bd56-5e2d4ccfa60e
publicPath: its-dangerous-to-go-alone-take-this.md
slug: its-dangerous-to-go-alone-take-this
aliases: ["/former-address.html"]
```

- `id` is an immutable UUID created once. Deployed public UUIDs remain canonical through edits, renames, folder moves, status changes, imports, and republishes. Historical path-shaped Studio IDs may be retained privately as migration lookup provenance, but must never be emitted as canonical IDs.
- `publicPath` is the stable Markdown filename within its snapshot collection.
- `slug` is the explicit public address. Studio must not regenerate it from the title or derive it from a KDrive path after creation.
- `aliases` is an optional JSON array of former root-relative `.html` URLs. Before changing a published slug, Studio must append the previous URL and retain all earlier aliases.

Posts and Now entries additionally carry `date` and `status`. Published material may carry `publishedAt` and `updatedAt`. Pages do not need editorial dates.

## Relationships

Authored links between Write Placid documents use the persistent ID:

```markdown
[change in attention](doc:44180f64-b72b-4bfe-b721-e47acf9d7328)
```

The public build resolves that UUID relationship to the target’s current `.html` URL. Ordinary external URLs and public asset paths remain ordinary Markdown links.

## Publishing boundary

Studio publishes a flat snapshot into `content/posts`, `content/pages`, or `content/now`, plus `content/identity-manifest.json`. The manifest uses `{version: 1, documents: [{id, type, slug, path, url, aliases}], redirects: {oldUrl: currentUrl}}` and includes published documents only. The source KDrive location is deliberately absent from the public contract. Moving a document between KDrive editorial folders may change private state or presentation, but it must not change `id`, `publicPath`, `slug`, or `aliases`.

The public build validates the complete snapshot before producing the site. It rejects:

- missing, malformed, or duplicate UUIDs;
- missing, invalid, or mismatched `publicPath` values;
- invalid or duplicate public slugs;
- aliases that are invalid, duplicated, or collide with a current slug;
- redirect cycles (also structurally prevented by alias-to-canonical mapping);
- unresolved `doc:` relationships; and
- unresolved root-relative content links.
- any disagreement between published Markdown and `identity-manifest.json`.

The build emits routes from `slug` and redirects from the manifest. Each alias produces a durable compatibility document that forwards the old `.html` address to the current one while preserving query strings and fragments. GitHub Pages cannot emit application-controlled HTTP 301 responses, so these are canonicalized HTML redirects rather than server-status redirects.

At reader request time the deployed site is a static GitHub Pages snapshot. It does not contact KDrive or Studio.

## Studio coordination requirements

The Studio implementation must:

1. Preserve every deployed public UUID exactly and assign UUIDs to drafts before publication; retain any legacy path-shaped IDs only as private migration lookup provenance.
2. Index KDrive path separately as mutable location metadata.
3. Preserve `publicPath` and the explicit slug instead of recreating either from the title.
4. Append the previous published `.html` URL to `aliases` before a slug change.
5. Serialize `id`, `publicPath`, `slug`, and `aliases` on every save and publish.
6. Resolve database/cache records by `id`, using path only for synchronization.
7. Resolve authoring links before export and publish a matching version-1 identity manifest.
8. Gate publishing with `WRITE_PLACID_PUBLIC_CONTRACT_VERSION=1` until this contract is available publicly.

D1 may cache or index this information, but KDrive Markdown remains canonical for article bodies and folder hierarchy, and the identity fields stored with each Markdown document remain authoritative.
