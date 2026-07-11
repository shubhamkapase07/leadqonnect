-- Turso / libSQL schema for the free lead-finding engine.
-- Safe to run repeatedly (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,     -- `${source}_${source_id}`
  source        TEXT NOT NULL,        -- 'reddit' | 'twitter' | 'linkedin'
  source_id     TEXT NOT NULL,        -- native post id
  keyword       TEXT,                 -- the watch query that surfaced it
  subreddit     TEXT,
  author        TEXT,
  title         TEXT,
  body          TEXT,
  url           TEXT,
  created_utc   INTEGER,              -- post time, unix seconds
  fetched_at    INTEGER,              -- when we first stored it, unix seconds

  -- scores (0-100)
  intent_score  INTEGER DEFAULT 0,
  quality_score INTEGER DEFAULT 0,
  match_score   INTEGER DEFAULT 0,
  sentiment     TEXT,                 -- 'high' | 'medium' | 'low'
  reasons       TEXT,                 -- JSON array of short strings

  -- AI enrichment (Gemini); ai_used=0 means deterministic scoring only
  ai_used       INTEGER DEFAULT 0,
  ai_summary    TEXT,
  ai_angle      TEXT,                 -- suggested outreach angle

  -- workflow
  status        TEXT DEFAULT 'new',   -- new | contacted | dismissed | won
  note          TEXT DEFAULT '',
  updated_at    INTEGER,

  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_leads_intent  ON leads (intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status);

-- Cheap key/value log so the dashboard can show "last scan" info.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
