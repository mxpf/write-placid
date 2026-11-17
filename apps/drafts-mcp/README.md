# Write Placid Drafts MCP

An optional connection that lets a compatible AI assistant save private writing drafts to Write Placid Studio.

## Save a draft

The `save_write_placid_draft` tool sends a title and the complete body in Markdown to Studio. Send the whole draft, not a patch or an excerpt. You can also supply a date and a source link. A source needs both `source_label` and `source_url`.

The optional `dek` field adds a one-line summary below the title.

Use the current tool to create new drafts. Open Studio to revise an existing draft. The tool accepts `current_title` and `slug`, but its save request does not yet include what Studio needs to update an existing draft safely.

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
```

For your own configured Worker, generate its types and deploy.

```bash
npm run cf-typegen
npm run deploy
```

To check a new connection, save a new private draft through the assistant and reopen it in Studio. With the demo settings, **Publish** stays hidden. Revise the draft in Studio, and use **Delete** there if you want to remove it.
