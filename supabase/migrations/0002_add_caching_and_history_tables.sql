-- EmailDiet Migration 0002: Add Caching, History, and Operational Metadata Tables (Tables 8-13)
-- Unified 1-to-1 User/Account Architecture (user_id foreign keys, exact constraints, SARGable indexes, RLS)

-- Table 8: scan_cache (Dashboard widget cache, 1 row per user workspace)
CREATE TABLE IF NOT EXISTS scan_cache (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_scan              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  total_messages         INTEGER DEFAULT 0,
  total_senders          INTEGER DEFAULT 0,
  unread_messages        INTEGER DEFAULT 0,
  storage_used_mb        NUMERIC(10, 2) DEFAULT 0,
  recoverable_storage_mb NUMERIC(10, 2) DEFAULT 0,
  health_score           SMALLINT DEFAULT 100,
  cleanup_score          SMALLINT DEFAULT 100,
  organization_score     SMALLINT DEFAULT 100,
  security_score         SMALLINT DEFAULT 100,
  newsletter_count       INTEGER DEFAULT 0,
  large_attachment_count INTEGER DEFAULT 0,
  mailbox_dna            JSONB DEFAULT '{}'::jsonb,
  dashboard_json         JSONB DEFAULT '{}'::jsonb,
  updated_at             TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 9: sender_cache (One row per sender per user workspace; zero email bodies stored)
CREATE TABLE IF NOT EXISTS sender_cache (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_email    TEXT NOT NULL,
  sender_name     TEXT,
  domain          TEXT,
  category        TEXT DEFAULT 'Other',
  total_messages  INTEGER DEFAULT 0,
  unread_messages INTEGER DEFAULT 0,
  storage_mb      NUMERIC(10, 2) DEFAULT 0,
  first_received  TIMESTAMPTZ,
  last_received   TIMESTAMPTZ,
  open_rate       SMALLINT DEFAULT 0,
  health_score    SMALLINT DEFAULT 100,
  recommendation  TEXT DEFAULT 'Review',
  verified        BOOLEAN DEFAULT FALSE,
  protected       BOOLEAN DEFAULT FALSE,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, sender_email)
);

-- Table 10: cleanup_history (Historical cleanup session metrics)
CREATE TABLE IF NOT EXISTS cleanup_history (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emails_removed     INTEGER NOT NULL DEFAULT 0,
  storage_saved_mb   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  time_saved_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds   INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 11: weekly_digest (Weekly report summary snapshots)
CREATE TABLE IF NOT EXISTS weekly_digest (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  summary      JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_start)
);

-- Table 12: saved_views (Custom Mailbox Explorer sidebar filters)
CREATE TABLE IF NOT EXISTS saved_views (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Table 13: scan_metadata (Operational profiling, timing & error diagnostics)
CREATE TABLE IF NOT EXISTS scan_metadata (
  scan_id        BIGSERIAL PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at   TIMESTAMPTZ,
  emails_scanned INTEGER DEFAULT 0,
  senders_found  INTEGER DEFAULT 0,
  duration_ms    INTEGER DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'running',
  error_message  TEXT
);

-- SARGable Performance Indexes (`Equality -> Range/Sort`, created CONCURRENTLY for zero locking)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sender_cache_user_email 
  ON sender_cache(user_id, sender_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sender_cache_user_category_received 
  ON sender_cache(user_id, category, last_received DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sender_cache_user_domain 
  ON sender_cache(user_id, domain);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sender_cache_user_received 
  ON sender_cache(user_id, last_received DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cleanup_history_user_created 
  ON cleanup_history(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_digest_user_week 
  ON weekly_digest(user_id, week_start DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_views_user_name 
  ON saved_views(user_id, name ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_metadata_user_started 
  ON scan_metadata(user_id, started_at DESC);

-- Enable Row-Level Security on all new tables (Supabase Security Invariant)
ALTER TABLE scan_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digest ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for service role and backend access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_scan_cache') THEN
    CREATE POLICY "service_role_scan_cache" ON scan_cache USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_sender_cache') THEN
    CREATE POLICY "service_role_sender_cache" ON sender_cache USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_cleanup_history') THEN
    CREATE POLICY "service_role_cleanup_history" ON cleanup_history USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_weekly_digest') THEN
    CREATE POLICY "service_role_weekly_digest" ON weekly_digest USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_saved_views') THEN
    CREATE POLICY "service_role_saved_views" ON saved_views USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_scan_metadata') THEN
    CREATE POLICY "service_role_scan_metadata" ON scan_metadata USING (true) WITH CHECK (true);
  END IF;
END $$;
