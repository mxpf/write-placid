# Write Placid Drafts MCP

An optional connection that lets a compatible AI assistant create and update private drafts in Write Placid Studio.

## Save a draft

The `save_write_placid_draft` tool sends a title and the complete body in Markdown to Studio. Send the whole draft, not a patch or an excerpt. You can also supply a date and a source link. A source needs both `source_label` and `source_url`.

The optional `dek` field is the draft's one-line summary. Include it to set or replace the summary. Leave `dek` out of a body update to keep the saved summary, including edits made in Studio. Send `dek: ""` to clear it. Every update still needs a title and the complete body.

To update a private draft, send its exact `slug` or its `current_title` along with the complete new body. To rename it, put the new name in `title`. If several pieces share a title, use the slug. A missing draft, conflicting title and slug, or piece with publication history returns an error.

Updates keep the draft's identity, so they change the same draft instead of creating another. Studio uses the saved version to check for competing edits. If it reports a conflict, reopen the draft and compare the writing before trying again.

A successful save returns the title, slug, and status. Open the connected Studio to read the draft and reopen it in a fresh tab. Drafts are stored by Studio.

The tool cannot publish or delete writing. To remove a private draft, use Studio's **Delete** button and confirm. Studio keeps a private recovery copy.

## Demo connection

The demo Drafts MCP is deployed on its own Worker and connects only to the demo Studio. It has its own sign-in app, OAuth storage, and credentials.

Add the MCP address in the [demo connection guide](../../README.md#demo-drafts-mcp) to a compatible AI assistant. Sign in with the approved Cloudflare Access account and approve the connection. You can then create and update private drafts with `save_write_placid_draft`.

In Studio, **Optional dek** below the title shows the same summary. You can edit it there and wait for **Saved online** before closing the tab. Studio joins line breaks into one line. Reopen the draft in a fresh tab to check its summary and writing. The summary stays private while publishing is disabled.

The demo Studio uses these settings.

- Set `WRITE_PLACID_STUDIO_D1_PREVIEW=1` to store private drafts in D1, with kDrive disconnected.
- Set `WRITE_PLACID_AUTO_PUBLISH=0` to turn off scheduled publishing.
- Leave `WRITE_PLACID_GITHUB_TOKEN` and `WRITE_PLACID_PUBLIC_CONTRACT_VERSION` unset.

Publishing stays disabled and Studio's **Publish** button stays hidden. Saving or deleting a private draft does not change the published site. Turning off scheduled publishing alone does not disable manual publishing.

See the [Studio README](../studio/README.md#demo-studio) and [demo Studio guide](../../README.md#demo-studio) for more about private drafts and opening Studio.

## Set up your own connection

Follow the [Drafts MCP setup guide](../../docs/SETUP.md#set-up-your-own-connection) for the full steps.

1. Use a separate Drafts MCP Worker in the same Cloudflare account as the Studio you want to use.
2. Choose your Worker name in `wrangler.jsonc`. Create a separate `OAUTH_KV` namespace and replace the placeholder ID. Set the `STUDIO` binding's `service` to your Studio Worker name.
3. Create a Cloudflare Access OIDC application for Drafts MCP. Use the Drafts MCP URL followed by `/callback` as its redirect URL and include the `openid`, `email`, and `profile` scopes.
4. Add the Worker secrets listed in [the example file](.dev.vars.example). Set `ALLOWED_EMAIL` to the approved email. `STUDIO_API_TOKEN` must match the connected Studio's `WRITE_PLACID_INTERNAL_TOKEN` and be unique to that connection. Use a separate random value for `COOKIE_ENCRYPTION_KEY`.
5. Add the deployed Drafts MCP URL followed by `/mcp` to your compatible AI assistant, then sign in and approve the connection.

Keep credentials and populated deployment configuration out of public Git.

## Checks and deployment

From `apps/drafts-mcp`, install dependencies, then run the type check and tests.

```bash
npm ci
npm run type-check
npm test
```

For your own configured Worker, generate its types and deploy.

```bash
npm run cf-typegen
npm run deploy
```

To check a new connection, save a private draft with a summary through the assistant. Edit the summary in Studio and wait for **Saved online**. Then update the body through the assistant using its slug and the complete revised body, leaving `dek` out. Reopen Studio in a fresh tab and confirm there is one updated draft with the same Studio summary. Include a new `dek` in another complete update and check that the summary changes.

With the demo settings, **Publish** stays hidden. Use Studio's **Delete** button if you want to remove the draft. Its private recovery copy keeps the summary and body.
