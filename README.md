# Write Placid

An open-source, self-owned publishing system for quiet writing. [See the live template](https://maxpfennig.haus/write-placid/).

Make Placid and Write Placid established a shared publishing foundation later used by [maxpfennig.haus](https://maxpfennig.haus) and [Thinkinghaus](https://thinking.haus). Write Placid uses the open-source Instrument Sans family and ships with sample content that is safe to replace.

![Write Placid publication](docs/site-desktop.png)

## What is included

- **[Site](apps/site/README.md)** — a fast public home for essays, pages, links, RSS, a single current `/now` entry, revision dates, and optional cached Webmentions.
- **[Studio](apps/studio/README.md)** — a private, phone-friendly rich-text editor. A basic setup stores writing in Cloudflare D1; when optional KDrive is enabled, KDrive becomes the canonical editorial source and D1 keeps supporting cache and private state. Studio can also bridge Google Docs and publish validated Markdown snapshots through GitHub.
- **[Drafts MCP](apps/drafts-mcp/README.md)** — an optional private bridge that lets a compatible AI assistant save a complete draft or revision to Studio without permission to publish or delete.
- **[Trackinghaus](apps/trackinghaus/README.md)** — optional, public, aggregate-only weekly analytics for the publication.

The pieces remain separate on purpose. A static public site has a much smaller failure surface than a CMS. Studio can be unavailable without taking the writing down. Tracking can be omitted entirely.

Write Placid owns the reusable publishing foundation as the versioned `@mxpf/write-placid-core` package. Downstream installations pin an immutable release while keeping their own content, brand, fonts, service bindings, and deployment identity. This preserves the project’s chronology: Make Placid and Write Placid preceded the later sites that use the foundation, including Thinkinghaus. See [Write Placid Core](docs/CORE.md) and the [parity ledger](docs/PARITY.md).

| Private Studio | Aggregate-only Trackinghaus |
| --- | --- |
| ![Write Placid Studio](docs/studio-editor.png) | ![Trackinghaus weekly reading](docs/trackinghaus-desktop.png) |

## Start locally

Requirements: Node.js 22.13 or newer.

```bash
git clone https://github.com/mxpf/write-placid.git
cd write-placid
npm run setup
npm run dev:site
```

Open [localhost:3000](http://localhost:3000). Follow the [site content contract](apps/site/docs/content-contract.md) when replacing the sample Markdown in [`apps/site/content`](apps/site/content), then edit [`apps/site/site.config.json`](apps/site/site.config.json).

For the private [Studio](apps/studio/README.md), [Trackinghaus](apps/trackinghaus/README.md), and optional [Drafts MCP](apps/drafts-mcp/README.md), follow the [operator’s manual](docs/SETUP.md).

## Useful commands

```bash
npm run dev:site       # public publication
npm run dev:studio     # private editor
npm run dev:tracking   # aggregate analytics dashboard
npm run check          # config, builds, tests, and type checks
```

## A small design position

Write Placid is deliberately super normal. It uses a restrained type scale, ordinary links, generous space, and very little interface decoration. The system is meant to help a person return to the writing, not admire the publishing machinery.

## Ownership

The code is available under the [MIT License](LICENSE). Instrument Sans is covered by the [SIL Open Font License](docs/Instrument-Sans-OFL.txt). Your writing remains yours.

Thinkinghaus is Max Pfennighaus’s publication and uses the shared publishing foundation established by Make Placid and Write Placid.
