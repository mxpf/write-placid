# Trackinghaus for Write Placid

An optional, public weekly analytics view for one publication.

Trackinghaus records daily aggregate counters by site, path, title, source category, and a browser-local returning flag. It does not store IP addresses, user agents, cookies, visitor IDs, raw referrers, query strings, or URL fragments. It respects Global Privacy Control and Do Not Track.

```bash
cp .env.example .env.local
npm install
npm run dev
npm test
```

Deploy this directory as the Vercel project root and connect a Neon database initialized with `db/schema.sql`. See the root [operator’s manual](../../docs/SETUP.md).
