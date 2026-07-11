-- LeadQonnect — Turso/libSQL schema (replaces Firestore).
-- Mirrors the Firestore model: per-user workspace docs are stored as JSON blobs
-- (matching the app's diff-sync of whole objects), with dedicated tables for the
-- relational/cross-account entities. Safe to run repeatedly.

-- === Auth + profile (replaces Firebase Auth users + the `users` collection) ===
CREATE TABLE IF NOT EXISTS users (
  uid                  TEXT PRIMARY KEY,
  email                TEXT UNIQUE NOT NULL,
  password_hash        TEXT,                     -- null for OAuth-only (Google) accounts
  name                 TEXT,
  photo_url            TEXT,
  plan                 TEXT NOT NULL DEFAULT 'free',   -- free | trial | premium | agency
  status               TEXT NOT NULL DEFAULT 'active', -- active | suspended
  role                 TEXT NOT NULL DEFAULT 'user',   -- user | admin
  team_role            TEXT,                     -- leader | member | null
  parent_uid           TEXT,                     -- leader's uid (for team members)
  must_change_password INTEGER NOT NULL DEFAULT 0,
  reddit               TEXT,                     -- JSON: display-only connection info
  gmail                TEXT,                     -- JSON: display-only connection info
  referral_code        TEXT UNIQUE,
  referred_by          TEXT,
  referred_by_uid      TEXT,
  razorpay             TEXT,                     -- JSON: billing state
  joined_at            TEXT,
  created_at           INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_parent  ON users (parent_uid);
CREATE INDEX IF NOT EXISTS idx_users_refcode ON users (referral_code);

-- === Per-user workspace (leads | campaigns | conversations | sequences) ===
-- JSON blob per doc, keyed exactly like Firestore so db.ts diff-sync maps 1:1.
CREATE TABLE IF NOT EXISTS workspace_docs (
  user_id    TEXT NOT NULL,
  collection TEXT NOT NULL,        -- 'leads' | 'campaigns' | 'conversations' | 'sequences'
  doc_id     TEXT NOT NULL,        -- item id (or leadId for conversations)
  json       TEXT NOT NULL,
  updated_at INTEGER,
  PRIMARY KEY (user_id, collection, doc_id)
);
CREATE INDEX IF NOT EXISTS idx_ws_user_coll ON workspace_docs (user_id, collection);

-- === Cross-account lead assignments (top-level, like Firestore `assignments`) ===
CREATE TABLE IF NOT EXISTS assignments (
  id             TEXT PRIMARY KEY,     -- `${ownerUid}__${leadId}`
  lead_id        TEXT NOT NULL,
  owner_uid      TEXT NOT NULL,
  owner_name     TEXT,
  owner_email    TEXT,
  assignee_email TEXT,                 -- lowercased
  assignee_uid   TEXT,
  assignee_name  TEXT,
  lead           TEXT,                 -- JSON snapshot of the lead
  status         TEXT,
  note           TEXT,
  assigned_at    TEXT,
  updated_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_assign_email ON assignments (assignee_email);
CREATE INDEX IF NOT EXISTS idx_assign_uid   ON assignments (assignee_uid);
CREATE INDEX IF NOT EXISTS idx_assign_owner ON assignments (owner_uid);

-- === Server-driven outreach sequence enrollments ===
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id            TEXT PRIMARY KEY,      -- `${leadId}__${sequenceId}`
  user_id       TEXT NOT NULL,
  lead_id       TEXT,
  lead_author   TEXT,
  sequence_id   TEXT,
  sequence_name TEXT,
  channel       TEXT,                  -- email | reddit
  recipient     TEXT,                  -- 'to' (reserved word avoided)
  current_step  INTEGER,
  total_steps   INTEGER,
  status        TEXT,                  -- active | completed | stopped | failed
  next_run_at   TEXT,
  created_at    TEXT,
  updated_at    TEXT,
  last_sent_at  TEXT,
  last_error    TEXT
);
CREATE INDEX IF NOT EXISTS idx_enroll_user   ON sequence_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_enroll_status ON sequence_enrollments (status);

-- === Team chat (one channel per team, keyed by leader uid) ===
CREATE TABLE IF NOT EXISTS team_chat_messages (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL,           -- leader uid
  sender_uid  TEXT,
  sender_name TEXT,
  text        TEXT,
  created_at  INTEGER                  -- ms epoch, for ordering
);
CREATE INDEX IF NOT EXISTS idx_chat_team ON team_chat_messages (team_id, created_at);

-- === Private OAuth tokens (server-only; never sent to client) ===
CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,         -- reddit | gmail
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    INTEGER,
  scope         TEXT,
  account       TEXT,                  -- username (reddit) or email (gmail)
  updated_at    INTEGER,
  PRIMARY KEY (user_id, provider)
);

-- CSRF nonces for the OAuth round-trip.
CREATE TABLE IF NOT EXISTS oauth_nonces (
  user_id    TEXT NOT NULL,
  provider   TEXT NOT NULL,
  nonce      TEXT,
  created_at INTEGER,
  PRIMARY KEY (user_id, provider)
);

-- === Razorpay subscription index (maps subscription id -> user) ===
CREATE TABLE IF NOT EXISTS razorpay_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  tier       TEXT,
  status     TEXT,
  plan_id    TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- === Referral click counters ===
CREATE TABLE IF NOT EXISTS referrals (
  code       TEXT PRIMARY KEY,
  owner_uid  TEXT,
  clicks     INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

-- === Client error logs ===
CREATE TABLE IF NOT EXISTS error_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  level      TEXT,
  context    TEXT,
  message    TEXT,
  stack      TEXT,
  url        TEXT,
  user_agent TEXT,
  meta       TEXT,
  client_at  TEXT,
  created_at INTEGER
);
