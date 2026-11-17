# Write Placid Drafts MCP

An optional connection that lets a compatible AI assistant save private writing drafts to Write Placid Studio.

## Save a draft

The `save_write_placid_draft` tool sends a title and the complete body in Markdown to Studio. Send the whole draft, not a patch or an excerpt. You can also supply a date and a source link. A source needs both `source_label` and `source_url`.

The optional `dek` field adds a one-line summary below the title. Omit it to keep the existing summary, or send an empty string to clear it.

To update a private draft, send its exact `slug` or its `current_title` along with the complete new body. To rename it, put the new name in `title`. If several pieces share a title, use the slug. A missing draft, conflicting title and slug, or piece with publication history returns an error.

Updates keep the draft's identity and use Studio's saved version to check for competing edits. If Studio reports a conflict, reopen the draft and compare the writing before trying again.

A successful save returns the title, slug, and status. Open the connected Studio to read the draft and reopen it in a fresh tab. Drafts are stored by Studio.

The tool cannot publish or delete writing. To remove a private draft, use Studio's **Delete** button and confirm. Studio keeps a private recovery copy.

## Keep the demo private

Drafts MCP is separate from Studio and is optional. If you connect it to the demo, use a separate Worker and point its `STUDIO` service binding at the demo Studio Worker.

Keep these settings on the demo Studio.

- Set `WRITE_PLACID_STUDIO_D1_PREVIEW=1` to store private drafts in D1, with kDrive disconnected.
- Set `WRITE_PLACID_AUTO_PUBLISH=0` to turn off scheduled publishing.
- Leave `WRITE_PLACID_GITHUB_TOKEN` and `WRITE_PLACID_PUBLIC_CONTRACT_VERSION` unset.

Publishing stays disabled and Studio's **Publish** button stays hidden. Saving or deleting a private draft does not change the published site. Turning off scheduled publishing alone does not disable manual publishing.

See the [Studio README](../studio/README.md#demo-studio) and [demo Studio guide](../../README.md#demo-studio) for more about private drafts and opening Studio.

## Set up the connection

Follow the [Drafts MCP setup guide](../../docs/SETUP.md#5-add-drafts-mcp) for the full steps.

1. Use a separate Drafts MCP Worker in the same Cloudflare account as the Studio you want to use.
2. Create an `OAUTH_KV` namespace and replace its placeholder ID in `wrangler.jsonc`. Set the `STUDIO` binding's `service` to the intended Studio Worker name.
3. Create a Cloudflare Access OIDC application for Drafts MCP. Use the Drafts MCP URL followed by `/callback` as its redirect URL and include the `openid`, `email`, and `profile` scopes.
4. Add the Worker secrets listed in [the example file](.dev.vars.example). Set `ALLOWED_EMAIL` to the approved email. `STUDIO_API_TOKEN` must match the connected Studio's `WRITE_PLACID_INTERNAL_TOKEN`. Use a separate random value for `COOKIE_ENCRYPTION_KEY`.
5. Add the deployed Drafts MCP URL followed by `/mcp` to your compatible AI assistant, then sign in and approve the connection.

Keep credentials and populated deployment configuration out of public Git.

## Checks and deployment

From `apps/drafts-mcp`, install dependencies and run the type check.

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

To check a new connection, save a new private draft through the assistant, revise it using its slug, and reopen it in Studio. Confirm the same draft contains the changes. With the demo settings, **Publish** stays hidden. Use Studio's **Delete** button if you want to remove the draft.
