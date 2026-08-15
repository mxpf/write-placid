# Write Placid Drafts MCP

An optional private bridge from a compatible AI assistant to Write Placid Studio.

The exposed tool saves a complete new draft or revision. It cannot publish or delete writing. Studio still owns those decisions.

The Worker uses Cloudflare Access for the user-facing OAuth flow, a service binding for private Studio traffic, and a shared internal token. Follow the root [operator’s manual](../../docs/SETUP.md) before deployment.
