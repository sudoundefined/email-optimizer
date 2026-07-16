-- EmailDiet Migration 0004: Unify User/Account Architecture (1:1 Model)
-- Safely migrates existing database tables from accounts/account_id/singleton to users/user_id/per-user tables.

DO $$
DECLARE
  col_exists BOOLEAN;
  tbl_exists BOOLEAN;
BEGIN
  -- 1. Rename accounts to users if needed
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') INTO tbl_exists;
  IF tbl_exists THEN
    SELECT NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') INTO col_exists;
    IF col_exists THEN
      ALTER TABLE accounts RENAME TO users;
    END IF;
  END IF;

  -- Drop is_default if present on users
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_default') INTO col_exists;
  IF col_exists THEN
    ALTER TABLE users DROP COLUMN is_default;
  END IF;

  -- 2. Rename account_id to user_id across child tables if they exist
  DECLARE
    t TEXT;
    target_tables TEXT[] := ARRAY['tokens', 'label_registry', 'activity_log', 'digest_baseline', 'scan_cache', 'sender_cache', 'cleanup_history', 'weekly_digest', 'saved_views', 'scan_metadata'];
  BEGIN
    FOREACH t IN ARRAY target_tables LOOP
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'account_id') INTO col_exists;
      IF col_exists THEN
        EXECUTE format('ALTER TABLE %I RENAME COLUMN account_id TO user_id;', t);
      END IF;
    END LOOP;
  END;

  -- 3. Migrate preferences from global id=1 singleton to per-user table (user_id PRIMARY KEY)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preferences' AND column_name = 'id') INTO col_exists;
  IF col_exists THEN
    CREATE TABLE IF NOT EXISTS preferences_new (
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

    -- Copy singleton settings to all existing users
    INSERT INTO preferences_new (user_id, scan_max_messages, default_time_range, label_prefix, digest_enabled, digest_day, digest_hour, digest_recipient, digest_senders)
    SELECT u.id, p.scan_max_messages, COALESCE(p.default_time_range, '3m'), COALESCE(p.label_prefix, 'Unsub/'), COALESCE(p.digest_enabled, 0), COALESCE(p.digest_day, 1), COALESCE(p.digest_hour, 8), COALESCE(p.digest_recipient, ''), COALESCE(p.digest_senders, '[]'::jsonb)
    FROM users u CROSS JOIN preferences p
    WHERE p.id = 1
    ON CONFLICT (user_id) DO NOTHING;

    DROP TABLE preferences CASCADE;
    ALTER TABLE preferences_new RENAME TO preferences;
    ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "service_role_preferences" ON preferences USING (true) WITH CHECK (true);
  END IF;

  -- 4. Migrate protected_senders from global to per-user (user_id REFERENCES users)
  SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'protected_senders' AND column_name = 'user_id') INTO col_exists;
  IF col_exists THEN
    CREATE TABLE IF NOT EXISTS protected_senders_new (
      id        BIGSERIAL PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email     TEXT NOT NULL,
      domain    TEXT,
      source    TEXT DEFAULT 'manual',
      added_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, email)
    );

    -- Copy existing global protected senders to all users
    INSERT INTO protected_senders_new (user_id, email, domain, source, added_at)
    SELECT u.id, ps.email, ps.domain, ps.source, ps.added_at
    FROM users u CROSS JOIN protected_senders ps
    ON CONFLICT (user_id, email) DO NOTHING;

    DROP TABLE protected_senders CASCADE;
    ALTER TABLE protected_senders_new RENAME TO protected_senders;
    ALTER TABLE protected_senders ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "service_role_protected_senders" ON protected_senders USING (true) WITH CHECK (true);
  END IF;
END $$;
