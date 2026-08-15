# Write Placid Studio

The private, phone-friendly editor for a Write Placid publication.

Studio reads Markdown from the configured GitHub repository, keeps working drafts in Cloudflare D1, optionally syncs Google Docs, and publishes by committing Markdown through the GitHub Contents API. Protect the deployed Worker with Cloudflare Access.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Never commit `.env.local` or a live `wrangler.cloudflare.jsonc` database ID to a public fork. Production setup is documented in the root [operator’s manual](../../docs/SETUP.md).
