/**
 * Default fallback values for user scanning preferences when a database row
 * in `preferences` has not customized them yet or returns null/undefined.
 */
export const SCAN_DEFAULTS = {
  /** Default maximum number of email message IDs to scan from Gmail during inbox analysis. */
  MAX_MESSAGES: 5000,
  /** Default time horizon for scanning emails ('1m' = 1 month, '3m' = 3 months, '6m', '1y', 'all'). */
  TIME_RANGE: '3m',
  /** Default string prefix prepended to custom Gmail labels created via the application. */
  LABEL_PREFIX: 'Unsub/',
}

/**
 * Upper limit ceilings and default batch bounds for SQL queries, pagination,
 * and API responses to prevent memory exhaustion and slow table scans.
 */
export const LIST_LIMITS = {
  /** Default ceiling for returning sender rows from `scanCache` / SQL lookups (`LIMIT 5000`). */
  SENDERS_DEFAULT: 5000,
  /** Default number of recent messages returned per group/filter view in UI tables (`LIMIT 100`). */
  MESSAGES_DEFAULT: 100,
  /** Absolute hard cap for batch processing or single-pass message fetching (`LIMIT 1000`). */
  MESSAGES_MAX: 1000,
  /** Maximum number of audit activity log entries to return in the activity feed (`LIMIT 50000`). */
  ACTIVITY_LOGS: 50000,
  /** Maximum number of registered label records returned in a single query (`LIMIT 1000`). */
  LABELS: 1000,
  /** Maximum number of connected Google accounts allowed per multi-tenant hub (`LIMIT 100`). */
  ACCOUNTS: 100,
  /** Default page size when fetching paginated audit activity logs (`LIMIT 20`). */
  AUDIT_PAGE_DEFAULT: 20,
  /** Maximum number of top senders returned for storage charts and top lists (`LIMIT 10`). */
  TOP_SENDERS_CHART: 10,
  /** Maximum number of historical weekly digest runs retained per user (`LIMIT 20`). */
  DIGEST_HISTORY_MAX: 20,
  /** Maximum allowed page size per single Gmail API request (`maxResults: 500`). */
  GMAIL_API_PAGE_SIZE: 500,
}
