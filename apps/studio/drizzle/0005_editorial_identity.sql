-- Cache-only metadata. Identity, aliases, and publicPath live in KDrive frontmatter.
ALTER TABLE documents ADD COLUMN editorial_json TEXT NOT NULL DEFAULT '{}';
