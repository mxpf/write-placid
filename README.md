# Write Placid

Write Placid is an open-source publishing system for writers who want the machinery to stay out of the way.

It gives you a fast public site, a private writing studio, optional aggregate analytics, and a narrow AI bridge for saving drafts. The pieces are separate on purpose: the public writing should keep working even when the private tools are being changed, removed, or ignored.

![Write Placid publication](docs/site-desktop.png)

## Why This Exists

Most publishing systems slowly become systems for managing publishing systems.

Write Placid is built around a simpler premise: the software should protect the conditions that make writing possible. Attention comes first. A draft is not just content moving through a pipeline; it is a place where the writer can notice, test, revise, abandon, return, and discover what the piece is actually asking for.

The public site therefore stays small and portable. The private studio exists to help a writer keep going. AI support, where present, is intentionally bounded: it can help create drafts and revisions, but it should not become a hidden publisher, owner, or substitute for the writer's judgment.

Write Placid packages the system developed for [Thinkinghaus](https://thinking.haus) without its personal writing, identity, credentials, private infrastructure, or licensed typeface. It uses the open-source Instrument Sans family and ships with sample content that is safe to replace.

## What You Get

- **Site** — a fast public home for essays, pages, links, RSS, a single current `/now` entry, revision dates, and optional cached Webmentions.
- **Studio** — a private, phone-friendly rich-text editor that saves drafts to Cloudflare D1, optionally synchronizes KDrive or Google Docs, and publishes Markdown through GitHub.
- **Drafts MCP** — an optional private bridge that lets a compatible AI assistant save a complete draft or revision to Studio without permission to publish or delete.
- **Trackinghaus** — optional, public, aggregate-only weekly analytics for the publication.

The public surface is deliberately boring in the best way: static output, ordinary links, readable HTML, RSS, and a small configuration file for identity and service settings. The private surfaces can be useful, but none of them should make the writing dependent on a dashboard being healthy.

| Private Studio | Aggregate-only Trackinghaus |
| --- | --- |
| ![Write Placid Studio](docs/studio-editor.png) | ![Trackinghaus weekly reading](docs/trackinghaus-desktop.png) |

## Design Position

Write Placid tries to feel plain, not empty.

It uses a restrained type scale, generous space, ordinary navigation, and very little interface decoration. The goal is not to impress the reader with the publishing apparatus. The goal is to let the writing arrive with enough structure, calm, and care that the reader can enter it.

That same judgment shapes the private tools. Studio should support revision without turning every sentence into a productivity object. Trackinghaus shows aggregate reading patterns without identifying readers. The AI bridge can help move writing into the system, but it cannot publish, delete, or own the meaning of the work.

## Start Locally

Requirements: Node.js 22.13 or newer.

```bash
git clone https://github.com/mxpf/write-placid.git
cd write-placid
npm run setup
npm run dev:site
```

Open `http://localhost:3000`. Replace the sample Markdown in `apps/site/content`, then edit `apps/site/site.config.json`.

For the private Studio, Trackinghaus, and the optional chat bridge, follow the [operator’s manual](docs/SETUP.md).

## Useful Commands

```bash
npm run dev:site       # public publication
npm run dev:studio     # private editor
npm run dev:tracking   # aggregate analytics dashboard
npm run check          # config, builds, tests, and type checks
```

## Project Shape

- `apps/site` contains the public publication.
- `apps/studio` contains the private editor.
- `apps/drafts-mcp` contains the optional AI-to-Studio bridge.
- `apps/trackinghaus` contains the optional aggregate analytics dashboard.
- `docs/SETUP.md` explains the operational setup.

## Ownership

The code is available under the [MIT License](LICENSE). Instrument Sans is covered by the [SIL Open Font License](docs/Instrument-Sans-OFL.txt). Your writing remains yours.

Thinkinghaus is Max Pfennighaus’s publication. Write Placid is the reusable system extracted from it.
