# EmailDiet V2 Features & Architectural Enhancements

This document catalogs all advanced capabilities, SQL database optimizations, deterministic calculation engines, and user onboarding flows built in **V2 of the EmailDiet platform**, synthesized from both our DBA optimization walkthrough and our calculation engine walkthroughs.

---

## Part 1: PostgreSQL DBA & High-Performance SQL Architecture

All queries and schema definitions across the repository (`server/src/models/`, `server/src/db/db.js`, and `supabase/migrations/`) have been optimized according to industry-standard Database Administrator (DBA) benchmarks:

### 1. SARGable Query Filtering & Index-Only Scans
- **Elimination of Non-SARGable Function Wrappers**: Removed `lower(email)` inside `WHERE` predicates on indexed columns (e.g., `protected_senders.email`, `accounts.email`). Since emails are pre-normalized (`toLowerCase().trim()`) before database insertion, raw equality checks (`WHERE email = $1`) allow PostgreSQL to perform **Index Only Scans** (`shared hit=1` buffer, `<0.01ms` execution).
- **Zero Sequential Scans on Hot Paths**: Primary lookups (`findByEmail`, `isProtected`, `findById`) hit B-tree indexes directly without forcing table scans or reading unneeded memory pages.

### 2. Composite Index Reordering (Equality $\rightarrow$ Range/Sort)
- **Multi-Column Index Optimization**: Replaced single-column indexes with precise composite indexes structured to put exact equality predicates first, followed by range/sort columns:
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_account_action_id 
    ON activity_log(account_id, action, id DESC);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_account_id 
    ON activity_log(account_id, id DESC);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_label_registry_account_name 
    ON label_registry(account_id, label_name ASC);
  ```
- **Zero-Sorting Queries**: For queries like `WHERE account_id = $1 AND action = $2 ORDER BY id DESC LIMIT 20`, PostgreSQL traverses `idx_activity_log_account_action_id` leaves in exact index order without invoking in-memory sort algorithms (`shared hit <= 3 buffers`).

### 3. Explicit Projections & Unbounded Result Protection (`LIMIT` Enforcement)
- **Zero `SELECT *`**: Every SQL query explicitly defines the target column projection (e.g., `SELECT id, email, display_name, avatar_url, is_default, created_at, last_login_at FROM accounts`).
- **Bounded Result Sets**: Enforced strict safety ceilings across all table queries (`LIMIT 1` for singleton probes, `LIMIT 100` for account listings, `LIMIT 5000` for protected senders, and `LIMIT 50000` for activity log batch aggregations).
- **Non-Blocking Index Creation**: All index definitions use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` to ensure zero table locking during production deployment.

### 4. Dynamic Database Scan Limits & Gmail Pagination
- **`listMessagesPaginated` Helper**: Centralized pagination layer that dynamically queries `preferences.scan_max_messages` (`getEffectiveScanLimits`) and fetches IDs in `Math.min(limits.maxMessages, remaining, 500)` chunks using `p-limit(20)` rate-limited batches and `AbortSignal` cancellation support.
- **Service Integration**: Hardcoded values eliminated across `scanService.js`, `storageService.js`, `labelService.js`, `inboxService.js`, `retentionService.js`, and `messageTrashService.js`.

---

## Part 2: First Login Onboarding Journey & Mailbox Story

A seamless, step-by-step onboarding journey guides users through connecting their account, configuring custom scan settings, auto-protecting sensitive categories, and viewing an interactive "Mailbox Story" before landing on the dashboard:

### 1. Persistent Onboarding State (`onboardingService.js`)
- **Schema Columns (`preferences` table)**:
  - `onboarding_step` (`TEXT DEFAULT 'welcome'`): Tracks progress across `'welcome'`, `'privacy'`, `'config'`, `'scanning'`, `'story'`, `'celebration'`, and `'completed'`.
  - `has_completed_onboarding` (`INTEGER DEFAULT 0`): Boolean flag distinguishing first-time onboarding from returning users.
  - `protected_categories` (`JSONB DEFAULT '[]'::jsonb`): Stores categories selected during onboarding configuration (e.g., `'Banking'`, `'Finance'`, `'Bills'`, `'Medical'`).
- **State Evaluation**: `getOnboardingState(userId)` returns current step status, protected categories, and computes `shouldStartAtDashboard` (`isCompleted`) so the client app knows exactly where to route returning vs. new users.

### 2. Scan Configuration & Auto-Seeding (`configureOnboardingScan`)
- Allows users to select their historical scan depth (`timeRange: '3m' | '6m' | '1y' | 'all'`), message ceiling (`maxMessages`), and categories to protect (`protectedCategories`).
- **Post-Scan Auto-Protection (`autoSeedProtectedCategories`)**: After the initial inbox scan completes, `scanService.js` invokes this hook to automatically match discovered senders against selected protected categories and insert them into the `protected_senders` whitelist (`ON CONFLICT DO NOTHING`), immediately shielding sensitive senders.

### 3. Mailbox Story (`GET /api/user/onboarding/story`)
- Generates an executive summary of the initial scan results (`MailboxStoryResponse`), calculating:
  - `totalEmails`, `totalStorageBytes`, `totalStorageMB`, and `totalStorageGB`.
  - `subscriptionSendersCount` and `promotionsAndMarketingCount` with dedicated `promotionsStorageMB/GB`.
  - `topSenders`: The top 5 heaviest senders by combined size estimate.
  - `dominantCategory`: The leading clutter category (`Promotions`, `Newsletters`, `Social`, etc.) with percentage and sender count.
  - `cleanupPotential`: Total recoverable messages, storage MB/GB, and estimated manual reading hours saved.
  - `isClean`: Boolean flag (`true` when promotions + subscriptions < 5) enabling the "Clean Mailbox" fast-path directly to the dashboard.

### 4. Post-Cleanup Celebration Triggers (`triggerOnboardingCelebrationIfApplicable`)
- Embedded directly into `unsubscribeService.js` (`runUnsubscribe`) and `trashService.js` / `messageTrashService.js` (`runTrashSenders`, `trashMessages`).
- When a user performs their **first cleanup action** (`has_completed_onboarding === false`), the engine:
  1. Transitions `onboarding_step = 'completed'` and sets `has_completed_onboarding = 1` atomically.
  2. Computes and returns a `CelebrationPayload`:
     - `emailsCleaned`: Number of items unsubscribed or moved to trash.
     - `storageMB`: Reclaimed or isolated storage in megabytes.
     - `timeSavedMinutes`: Estimated time saved (`Math.round((emailsCleaned * 4) / 60)` based on 4 seconds per email triage).
     - `healthImprovement`: Instant boost (`+5` to `+25` points) to the Mailbox Health Score.
  3. Triggers an immediate recalculation of the dashboard insights cache (`recalculateInsights`).
- Returning users (`has_completed_onboarding === true`) bypass duplicate transitions, returning `null` while still refreshing dashboard scores.

---

## Part 3: Deterministic Scoring & Insights Engine (`server/src/services/insights/`)

To deliver immediate, sub-10ms explainable insights without third-party AI latency, API costs, or JSON wrapping inside loops, V2 introduces a fully deterministic **Normalization $\rightarrow$ Scoring $\rightarrow$ Widgets** calculation engine:

### 1. Normalization Engine (`normalizationEngine.js`)
- Aggregates raw scan metrics into a unified, clean snapshot (`NormalizedMetrics`):
  - Total message counts, total storage bytes/MB, unread counts, and total/protected sender counts.
  - Subscription vs. non-subscription counts, promotions and marketing counts, and category distribution maps (`categoryCounts`, `categoryMessages`, `categoryStorageBytes`).
  - Size breakdowns for large attachments (`>5MB`), newsletters, and general messages.
  - Gamification metrics (`recentCleanupSessionsCount`, `cleanupStreakDays`).

### 2. Scoring Engine (`scoringEngine.js`)
- Evaluates the **Mailbox Health Score (0 to 100)** formula using exact component weights:
  - **Cleanliness (25%)**: Ratio of clean emails vs. promotional/subscription clutter.
  - **Storage Efficiency (20%)**: Storage consumed compared against high-clutter baselines.
  - **Subscription Hygiene (20%)**: Proportion of active subscriptions vs. inactive/forgotten recurring senders.
  - **Organization (15%)**: Proportion of labeled senders and unread management.
  - **Sender Trust (10%)**: Ratio of protected/important senders vs. unknown bulk mailers.
  - **Cleanup Activity (10%)**: Gamified boost from recent cleanup sessions and active streaks.
- Computes secondary breakdown scores (`organizationScore`, `securityScore`, `priorityScore`) and assigns an intuitive `healthLevel`:
  - **`Excellent`** (80–100)
  - **`Good`** (65–79)
  - **`Fair`** (50–64)
  - **`Needs Attention`** (< 50)
- Computes aggregated `cleanupPotential` (`messages`, `storageMB`, `storageGB`, `percentageOfTotal`).

### 3. Insights Engine (`insightsEngine.js` — 14+ Explainable Widgets)
- Generates structured widgets (`DashboardWidgets`), where every single widget includes a deterministic `why` string (explaining exact reasons in plain English) and an actionable `action` object (`{ label, type, target }`):
  1. **`health`**: Overall score, health level, and 6-part component breakdown.
  2. **`topPriorities`**: List of top actionable opportunities (`PriorityOpportunity[]`) ranked by combined `messageCount * storageMB` impact score.
  3. **`dna`**: Mailbox Identity profiling based on dominant category distribution (`'Shopping Heavy'`, `'Newsletter Collector'`, `'Social & Notification Heavy'`, `'Balanced User'`, `'Work & Financial Hub'`).
  4. **`promotions`**: Alert widget highlighting total promotional volume and storage impact.
  5. **`storage`**: Storage recovery metrics broken down by large attachments, old promotions, and newsletters.
  6. **`timeSaved`**: Time-savings calculator expressing reclaimed time in reading minutes, hours, and full 8-hour work days.
  7. **`streak`**: Active cleanup streak tracker and recent session counter.
  8. **`forecast`**: 30-day predictive growth forecast showing projected message and storage accumulation if left unchecked.
  9. **`achievements`**: 7 unlockable gamification badges:
     - `first_cleanup`: Performed your first cleanup action.
     - `inbox_zero_hero`: Achieved under 100 total emails or < 10% unread.
     - `storage_saver_100mb`: Reclaimed over 100 MB of storage.
     - `storage_saver_1gb`: Reclaimed over 1 GB of storage.
     - `unsubscriber_10`: Unsubscribed from 10 or more senders.
     - `streak_master`: Maintained a 3-day cleanup streak.
     - `security_sentinel`: Protected 5 or more trusted bank/utility senders.
  10. **`cleanupPotential`**: Summary card of total recoverable assets.

### 4. Atomic Caching & Sub-10ms API Delivery (`insightsService.js`)
- **Atomic Caching**: Every time a scan or cleanup occurs, `insightsService.recalculateInsights(userId)` computes the full dashboard payload and saves it into `ScanCacheRepository` inside the `dashboard_json` (JSONB) column (`cache_scans` / `scan_cache`).
- **Instant Retrieval**: `GET /api/insights/dashboard` serves the precomputed `dashboard_json` instantly (`<10ms`), falling back to live calculation only when the cache is empty.
- **Dedicated Drill-Down Endpoints**:
  - `GET /api/insights/health`
  - `GET /api/insights/priorities`
  - `GET /api/insights/dna`
  - `GET /api/insights/achievements`
  - `POST /api/insights/recalculate`

---

## Part 4: Verification & Test Harness Summary

Both engines are verified by comprehensive automated tests (`161 tests passing across 17 suites` in backend Node.js `--test`, `48 tests passing across 2 suites` in frontend Vitest):
- **`server/test/insightsEngine.test.js`**: Verifies bounded `healthScore` (0-100), breakdown properties, and deterministic `why`/`action` payloads across all 14+ widgets.
- **`server/test/onboarding.test.js`**: Verifies state transitions (`welcome` $\rightarrow$ `scanning` $\rightarrow$ `story` $\rightarrow$ `completed`), `shouldStartAtDashboard` evaluation, and celebration calculation accurately advancing `has_completed_onboarding`.
- **`server/test/repositories.test.js`**: Verifies SARGable indexed queries and explicit `LIMIT` execution across all 7 core repositories.
