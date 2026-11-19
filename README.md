# Write Placid

Write Placid is an open-source template for publishing your own writing. Start with a public site and add a private editor or analytics if you need them. The template comes with sample writing you can replace. [See the live demo](https://maxpfennig.haus/write-placid/).

The latest core release is [1.7.1](https://github.com/mxpf/write-placid/releases/tag/v1.7.1). It updates Studio's icons and the development tools, including TypeScript 7. Read the [release notes](docs/releases/v1.7.1.md) and [upgrade steps](docs/SETUP.md#upgrade-to-171) before updating an existing site.

![Write Placid publication](docs/site-desktop.png)

## What is included

- [**Site**](apps/site/README.md) builds a static website from Markdown. It includes essays, standalone pages, an RSS feed, and a `/now` page for your latest update.
- [**Studio**](apps/studio/README.md) is an optional private editor that works on phones. It can store private drafts in Cloudflare D1. kDrive storage and Google Docs sync are optional. When publishing is enabled, Studio sends the Markdown files to GitHub.
- [**Drafts MCP**](apps/drafts-mcp/README.md) lets a compatible AI assistant create and update private drafts in Studio. The tool cannot publish or delete writing.
- [**Trackinghaus**](apps/trackinghaus/README.md) is an optional public dashboard that shows weekly page-view counts.

The public site serves static files, so readers can visit it when Studio is offline.

| Studio editor | Trackinghaus dashboard |
| --- | --- |
| ![Write Placid Studio](docs/studio-editor.png) | ![Trackinghaus weekly reading](docs/trackinghaus-desktop.png) |

## Demo Studio

The demo Studio requires an approved Cloudflare Access sign-in. You can open it from an article's **Edit** link after adding `#edit` to the article's address. [Open the demo Studio](https://write-placid-studio.maxpfennighaus.workers.dev/).

Choose **New piece** to create a private draft. Studio saves changes automatically. Wait for **Saved online** before closing the tab. You can reopen the draft in a fresh tab. **Delete** removes it from the library and keeps a private recovery copy.

Use **Optional dek** below the title to add a one-line summary. Studio keeps it on one line and saves it with the private draft. You can edit it later or leave it empty.

Publishing is disabled in the demo, so the **Publish** button is hidden.

### Demo Drafts MCP

Add [the demo Drafts MCP address](https://write-placid-drafts-mcp.maxpfennighaus.workers.dev/mcp) to a compatible AI assistant. Sign in with the approved Cloudflare Access account and approve the connection. This is a separate Worker connected only to the demo Studio.

Use `save_write_placid_draft` with a title and the complete draft in Markdown. To update a private draft, send its exact `slug` or `current_title` and the complete revised body. Put the new name in `title` if you want to rename it. Studio updates the same draft and checks for competing edits.

Include `dek` to set or replace the one-line summary. Leave `dek` out of an update to keep the summary already saved in Studio. Send `dek: ""` to clear it.

The tool cannot update pieces with publication history. If several pieces share a title, use the slug. If Studio reports a save conflict, reopen the draft and compare the writing before trying again. Publishing stays disabled.

## Start locally

Use Git and Node.js 22 (22.13 or newer). `npm run setup` installs dependencies for all four apps. TypeScript 7 runs the type checks and builds the shared core; a separate TypeScript 6 compatibility package keeps Site and Studio's lint tools working.

If you’re using PowerShell on Windows with Git Bash installed, set npm to use Bash before running the preview commands.

```powershell
$env:npm_config_script_shell = 'C:\Program Files\Git\bin\bash.exe'
```

```bash
git clone https://github.com/mxpf/write-placid.git
cd write-placid
npm run setup
npm run dev:site
```

Open the local URL printed in your terminal. Replace the sample Markdown in [`apps/site/content`](apps/site/content) and set your site’s name, description, and URL in [`apps/site/site.config.json`](apps/site/site.config.json). The [content guide](apps/site/docs/content-contract.md) explains how to keep links working when you edit or move a page.

The [setup guide](docs/SETUP.md) covers publishing to GitHub Pages and configuring the optional apps. To preview Studio or Trackinghaus locally, use `npm run dev:studio` or `npm run dev:tracking`.

## Run the checks

Install Chromium for the browser tests after running setup. Then run the project checks and Site lint from the repository root.

```bash
npm exec --prefix apps/site -- playwright install chromium
npm run check
npm run lint --prefix apps/site
```

The checks run in PowerShell on Windows and in the default shell on macOS and Linux. Browser tests choose their own local ports, so other previews can stay open.

## Design and shared code

The design keeps the focus on the writing with simple typography, underlined links, and generous spacing. It uses Instrument Sans and the [Thinkinghaus color palette](docs/DESIGN.md).

Make Placid and Write Placid laid the groundwork for [maxpfennig.haus](https://maxpfennig.haus) and Max Pfennighaus’s publication, [Thinkinghaus](https://thinking.haus). Other sites can use a specific release of `@mxpf/write-placid-core` and keep their own content, design, and hosting. See the [core package guide](docs/CORE.md) and [Thinkinghaus parity notes](docs/PARITY.md).

## Ownership

The code uses the [MIT License](LICENSE). Instrument Sans uses the [SIL Open Font License](docs/Instrument-Sans-OFL.txt). Your writing remains yours.
