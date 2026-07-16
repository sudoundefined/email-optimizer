-- EmailDiet Migration 0003: Add Missing SARGable Performance Indexes
-- Ensures every repository query across all 13 tables executes via indexed statements without sequential table scans under the 1:1 user/account model.

-- 1. users table: Index for created_at ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
  ON users(created_at ASC);

-- 2. label_registry table: Index for LabelRegistryRepository.findByGmailId & deleteByGmailId
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_label_registry_user_gmail_id 
  ON label_registry(user_id, gmail_id);

-- 3. activity_log table: Index for ActivityLogRepository.getGamificationStats timestamp filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_user_created 
  ON activity_log(user_id, created_at DESC);

-- 4. sender_cache table: Index for pruneStale cleanup and unread filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sender_cache_user_updated 
  ON sender_cache(user_id, updated_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sender_cache_user_unread 
  ON sender_cache(user_id, unread_messages) WHERE unread_messages > 0;

-- 5. scan_metadata table: Index for status checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_metadata_user_status 
  ON scan_metadata(user_id, status);

-- 6. protected_senders table: Index for source + email sorting scoped by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_protected_senders_user_source_email 
  ON protected_senders(user_id, source, email ASC);
