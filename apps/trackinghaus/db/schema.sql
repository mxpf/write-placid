CREATE TABLE IF NOT EXISTS trackinghaus_daily (
  site_key TEXT NOT NULL,
  day DATE NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  reads INTEGER NOT NULL DEFAULT 0,
  returning_reads INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_key, day, path, source)
);
