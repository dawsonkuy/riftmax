-- Verified rank snapshots for Riftmax; historical ranks before first observation are unknown.
CREATE TABLE IF NOT EXISTS rank_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  puuid TEXT NOT NULL,
  queue TEXT NOT NULL,
  tier TEXT NOT NULL,
  division TEXT NOT NULL DEFAULT '',
  lp INTEGER NOT NULL,
  score INTEGER NOT NULL,
  observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rank_snapshot_account ON rank_snapshots(platform,puuid,queue,observed_at DESC);
CREATE INDEX IF NOT EXISTS rank_snapshot_peak ON rank_snapshots(platform,puuid,queue,score DESC);
