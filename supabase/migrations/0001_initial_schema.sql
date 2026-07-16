-- EmailDiet Unified 1-to-1 User/Account Schema & RLS Configuration (Fresh Project V2 Entity)

-- Table 1: Users (1:1 with Google OAuth account, no multi-account switcher complexity)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMPTZ
);

-- Table 2: Encrypted Gmail OAuth tokens per user
CREATE TABLE IF NOT EXISTS tokens (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted     TEXT NOT NULL,
  iv            TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Per-user preferences (scoped strictly to each user workspace)
CREATE TABLE IF NOT EXISTS preferences (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scan_max_messages   INTEGER,
  default_time_range  TEXT DEFAULT '3m',
  label_prefix        TEXT DEFAULT 'Unsub/',
  digest_enabled      INTEGER DEFAULT 0,
  digest_day          INTEGER NOT NULL DEFAULT 1,
  digest_hour         INTEGER NOT NULL DEFAULT 8,
  digest_recipient    TEXT NOT NULL DEFAULT '',
  digest_senders      JSONB DEFAULT '[]'::jsonb
);

-- Table 4: Protected senders scoped per user workspace
CREATE TABLE IF NOT EXISTS protected_senders (
  id        BIGSERIAL PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email     TEXT NOT NULL,
  domain    TEXT,
  source    TEXT DEFAULT 'manual',
  added_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, email)
);

-- Table 5: Per-user label registry
CREATE TABLE IF NOT EXISTS label_registry (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label_name  TEXT NOT NULL,
  gmail_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, label_name)
);

-- Table 6: Activity audit log
CREATE TABLE IF NOT EXISTS activity_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  details     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 7: Digest baseline per user
CREATE TABLE IF NOT EXISTS digest_baseline (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  senders     JSONB DEFAULT '[]'::jsonb,
  last_run_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries (Equality columns before range/sort columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_label_registry_user_name ON label_registry(user_id, label_name ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_user_action_id ON activity_log(user_id, action, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_protected_senders_domain ON protected_senders(domain);

-- Enable Row-Level Security on all tables (Supabase Invariant)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE protected_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_baseline ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for service role and postgres access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_users') THEN
    CREATE POLICY "service_role_users" ON users USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_tokens') THEN
    CREATE POLICY "service_role_tokens" ON tokens USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_preferences') THEN
    CREATE POLICY "service_role_preferences" ON preferences USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_protected_senders') THEN
    CREATE POLICY "service_role_protected_senders" ON protected_senders USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_label_registry') THEN
    CREATE POLICY "service_role_label_registry" ON label_registry USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_activity_log') THEN
    CREATE POLICY "service_role_activity_log" ON activity_log USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_digest_baseline') THEN
    CREATE POLICY "service_role_digest_baseline" ON digest_baseline USING (true) WITH CHECK (true);
  END IF;
END $$;
