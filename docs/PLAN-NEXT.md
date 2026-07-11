# Implementation Plan — Next Tier (rules & automation)

**Status:** 📋 Pending — blocked on the v8 quick-wins tier ([PLAN-QUICK-WINS.md](PLAN-QUICK-WINS.md)), which has not started as of 2026-07-11. Roadmap tier: **v9** — see [ROADMAP.md](../ROADMAP.md).

The v9 tier turns EmailDiet from a *manual* cleanup tool into a *self-maintaining* one. Nine features across five themes, all built on shipped subsystems — the metadata cache, job manager (SSE), generic scheduler tick (from quick-wins #2), retention engine, audit log, protect-list, and `FILTER_DEFS` — without violating core invariants (metadata-only storage, trash-only deletes, per-user tenant isolation, no new OAuth scopes).

**Prerequisite:** the quick-wins tier ([PLAN-QUICK-WINS.md](PLAN-QUICK-WINS.md)) must ship first. This tier reuses its generic scheduler loop, digest sections plumbing, signed action tokens, and `storage_snapshots` data.

Suggested build order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9** (data layers first, UI-heavy and dependent features last).

---

## 1. Engagement stats — never-read report

**Goal:** Surface senders you subscribe to but never open, with one-click "unsubscribe from all never-read senders."

### Data

No new table needed for v1 — the scan metadata cache already carries `UNREAD` label state per message. Add a derived, per-sender computation:

```
readRate = 1 - (unreadCount / totalCount)
neverRead = totalCount >= 5 AND readRate == 0
rarelyRead = totalCount >= 5 AND readRate < 0.15
```

Minimum-sample threshold (5 messages) prevents one-off senders from being flagged.

### Backend

- `server/src/services/engagementService.js` — `computeEngagement(userId)` reads the warm scan cache (mirror `subscriptionsService` — 404 if no scan yet, zero extra Gmail calls) and returns per-sender `{ email, total, unread, readRate, bucket: 'never'|'rarely'|'normal' }`.
- `GET /api/engagement` — thin route, `req.userId` scoped.
- **Bulk action:** "Unsubscribe from all never-read" posts the never-read sender list to the *existing* unsubscribe pipeline (protect-list respected, per-sender results streamed via the job manager). No new mutation path.

### Frontend

- New **"Never opened"**-style segment in the Mailbox left filter pane: **Never read** and **Rarely read** (live counts), reusing the segment-chip pattern.
- Sender table gains an optional **Read rate** column (percentage bar, sortable), visible when an engagement segment is active.
- Header button in the segment view: **Unsubscribe all never-read** → existing multi-select unsubscribe flow with the confirm dialog pre-populated.

### Edge cases

- Scan with a short date range → read rates skewed; show the active scan range in the segment header ("based on last 3 months").
- Senders with no unsubscribe method are listed but excluded from the bulk action (counted and reported, same as elsewhere).

---

## 2. Engagement stats — open-rate heatmap

**Goal:** Per-sender open-rate visualization to find dead subscriptions at a glance.

### Backend

- Extend `computeEngagement` to also return a **monthly read-rate series** per sender (bucket message dates by month — data the cache already has).
- `GET /api/engagement/:email/series?months=12` — validated sender address (existing Gmail-query-injection guard), cache-only.

### Frontend

- Clicking a sender row in an engagement segment shows a **12-month heatmap strip** in the drill-down pane (existing detail-pane pattern): one cell per month, intensity = read rate, tooltip = `read/total`.
- Sort control: **Lowest open rate first** to surface dead subscriptions.
- No new chart library — cells are plain Chakra `Box`es with semantic-token backgrounds (`brand.*` scale), consistent across all four theme renderings.

### Edge cases

- Months with zero messages render as empty (neutral) cells, not 0 % (avoid false "dead" signal).

---

## 3. Auto-rules engine — conditional actions

**Goal:** Event-driven rules: "when a new marketing sender appears → auto-label + archive", "when a sender I unsubscribed from emails again → auto-trash + notify me."

### Schema

```sql
CREATE TABLE auto_rules (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  trigger      TEXT    NOT NULL CHECK(trigger IN ('new_sender','resubscribed','keyword')),
  trigger_arg  TEXT,               -- category for new_sender, keyword for keyword
  action       TEXT    NOT NULL CHECK(action IN ('label','archive','trash','unsubscribe','notify')),
  action_arg   TEXT,               -- label name when action='label'
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  last_fired_at TEXT
);

CREATE TABLE rule_events (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id    INTEGER NOT NULL REFERENCES auto_rules(id) ON DELETE CASCADE,
  sender     TEXT    NOT NULL,
  outcome    TEXT    NOT NULL,     -- acted | skipped_protected | skipped_cap | error
  detail     TEXT,                 -- JSON
  fired_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Backend

- `server/src/services/rulesService.js` — CRUD (`userId` first, always) + `evaluateRules(userId, context)`.
- **Evaluation points** (no new polling loop):
  1. **After every scan** — diff new senders vs. the digest baseline → fire `new_sender` rules (optionally filtered by category via `trigger_arg`).
  2. **After every scan** — cross-reference senders against the audit log's `unsubscribe` entries → fire `resubscribed` rules. *The shipped per-user unsubscribe audit log is the data source.*
  3. **Scheduler tick** — `keyword` rules run as a scheduled cached-metadata match (subject keyword), piggybacking the generic tick loop from quick-wins #2.
- **Actions** reuse existing pipelines: `label`/`archive` → `labelService`, `trash` → trash pipeline (protect-list skip + caps), `unsubscribe` → unsubscribe pipeline, `notify` → a digest section entry (and a desktop notification later, Platform tier).
- **Safety rails:** hard cap 500 messages per rule-firing; protected senders always skipped and counted; every firing writes `rule_events` + an `auto_rule` audit-log entry; `trash` is Gmail Trash only — never permanent.
- Routes: `GET/POST /api/rules`, `PATCH/DELETE /api/rules/:id`, `GET /api/rules/:id/events`, `POST /api/rules/:id/test` (dry run — returns what *would* fire against the current cache).

### Frontend

- (UI is feature #4 below — ship the engine behind the API first, verified by tests + dry-run endpoint.)

### Edge cases

- Two rules matching the same sender → execute in rule-`id` order; a `trash` result short-circuits later actions on that sender for the run (log `skipped_already_trashed`).
- Rule fires for a sender the user protects mid-run → click-time re-check, `skipped_protected` outcome.
- Expired token during a scheduled firing → `skipped_auth`, banner prompt, never silently disable (same convention as auto-clean rules).

---

## 4. Auto-rules engine — rule builder UI

**Goal:** Visual IF-THEN editor — Gmail-filters power, Zapier simplicity.

### Frontend

- New **Rules** section (tab or Account-page card, decide by nav crowding): rules table — name, trigger summary, action summary, enabled toggle, last fired, fired count.
- **Create/edit modal** — two-step IF → THEN layout:
  - **IF** dropdown: "a new sender appears" (+ optional category select fed by the categorizer's 18 categories) · "a sender I unsubscribed from emails again" · "a subject contains keyword" (+ text input, length-capped, trimmed).
  - **THEN** dropdown: apply label (+ label name input) · archive · move to Trash · unsubscribe · notify me in digest.
  - **Test rule** button → `POST /api/rules/:id/test` shows live "would fire for N senders" with a sample list.
- Per-rule **history drawer** — paginated `rule_events` (reuse the audit-log table component).
- All styling per DESIGN.md: pill controls, `3xl` modal, semantic tokens, `ConfirmDialog` for destructive actions (trash/unsubscribe rules get an arming-delay confirm on save).

### Edge cases

- `action='label'` with a label that no longer exists in Gmail → recreate via `labelService` (registry already handles this).
- Deleting a rule keeps its `rule_events` history? **No** — cascade delete (consistent with account-deletion hygiene); the audit log retains the summary entries.

---

## 5. Unsubscribe verification loop

**Goal:** 14 days after a one-click unsubscribe, verify the sender actually stopped; badge and escalate the ones still emailing.

### Schema

```sql
CREATE TABLE unsub_verifications (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_email  TEXT    NOT NULL,
  unsubscribed_at TEXT  NOT NULL,
  check_after   TEXT    NOT NULL,          -- unsubscribed_at + 14 days
  status        TEXT    NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','clean','still_emailing','escalated')),
  post_count    INTEGER NOT NULL DEFAULT 0, -- messages seen after unsubscribe
  checked_at    TEXT,
  UNIQUE(user_id, sender_email, unsubscribed_at)
);
```

### Backend

- **Enqueue:** successful `one-click` and `mailto` unsubscribes insert a `pending` row (link/manual methods excluded — completion isn't observable).
- **Check:** the generic scheduler tick picks up rows past `check_after`, runs a cached-metadata count of messages from that sender dated after `unsubscribed_at` (fall back to one targeted Gmail query `from:"<validated addr>" after:<date>` if the cache window doesn't cover it). `post_count > 0` → `still_emailing`, else `clean`.
- **Escalation path** (user-triggered, per sender): re-unsubscribe → create an auto-rule (`resubscribed → trash`) → export a native Gmail filter (feature #8). Each step writes to the audit log.
- Routes: `GET /api/verifications`, `POST /api/verifications/:id/escalate`.
- Digest gains a **"Still emailing you"** section (reuses the section plumbing from quick-wins).

### Frontend

- Sender table: **"Still emailing"** badge (warning-toned tag) on flagged senders; click → escalation popover with the three escalation options.
- Account & Logs: verification summary card — pending / clean / still-emailing counts.

### Edge cases

- User re-subscribes intentionally → "Dismiss" action marks the row `clean` (audit-logged).
- Sender uses a new address post-unsubscribe (`news@` → `updates@`) → out of scope v1; document as known limitation, revisit with domain-level matching.

---

## 6. Duplicate email detector

**Goal:** Flag duplicate messages via metadata only and offer batch-trash.

### Backend

- `server/src/services/duplicateService.js` — `findDuplicates(userId)` reads the scan cache and groups by `(sender, normalized subject, sizeEstimate ±2 %)` within a 48-hour window. Keys hashed in memory; **nothing persisted** (recomputed per scan — no body reads, no new table).
- Within each group the **oldest message is the keeper**; the rest are trash candidates.
- `GET /api/duplicates` (404 without a scan, mirroring `/senders`); `POST /api/duplicates/trash` → job manager, protect-list skip, 10k cap, per-group progress via SSE.

### Frontend

- **Duplicates** quick-filter-style entry in the Mailbox left pane with a live count.
- Detail pane: grouped list — keeper pinned with a "kept" tag, duplicates pre-checked, expandable per group. **Trash duplicates** in the header → `ConfirmDialog` with total count (typed confirm > 500, existing convention).

### Edge cases

- Legitimate resends (e.g. corrected newsletter) share subject+sender but differ in size beyond tolerance → not flagged (tolerance is deliberately tight).
- Threads: only messages *without* an `In-Reply-To`-style relationship are considered — skip anything in a thread with replies (thread ID data the scan already has).

---

## 7. Snooze + priority triage (SaneLater)

**Goal:** Auto-file low-priority mail to a `Later` label; snooze threads to resurface on schedule.

### Schema

```sql
CREATE TABLE snoozes (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id   TEXT    NOT NULL,
  wake_at     TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'sleeping' CHECK(status IN ('sleeping','woken','cancelled')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, thread_id, wake_at)
);

CREATE TABLE triage_prefs (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_email TEXT    NOT NULL,
  bucket       TEXT    NOT NULL CHECK(bucket IN ('inbox','later')),  -- explicit training signal
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, sender_email)
);
```

### Backend

- **Snooze:** `POST /api/threads/:id/snooze { wakeAt }` — remove `INBOX` label (recoverable in All Mail — *not* trash), insert row. The scheduler tick re-adds `INBOX` + `STARRED` for due rows and marks them `woken`. `DELETE /api/snoozes/:id` cancels (restores `INBOX` immediately).
- **Triage:** `triageService.classify(sender)` — explicit `triage_prefs` first, then heuristics (category ∈ {Promotions, Social, Newsletters} + read-rate < 0.15 from feature #1 → `later`). Applied to *new* mail via a scheduled pass over recent messages (cache + one incremental query), labeling `Unsub/Later` and archiving. **Opt-in per user** (preferences flag, default off).
- Training endpoints: `POST /api/triage/prefs { sender, bucket }` fired by drag/move actions in the UI.
- Everything audit-logged (`snooze`, `wake`, `triage`).

### Frontend

- Message/thread rows gain a **Snooze** menu (Tomorrow · 3 days · Next week · pick date). Snoozed list on Account & Logs with cancel buttons.
- **Later** appears in inbox groups; sender rows in the group offer **Move to Inbox** (trains `inbox`), and inbox marketing senders offer **Send to Later** (trains `later`).
- Triage opt-in toggle in Account preferences with a plain-language explanation of what it moves and how to undo (All Mail).

### Edge cases

- Server down at wake time → catch-up on next tick (same rule as digest/auto-clean).
- Thread receives a new message while snoozed → Gmail re-inboxes it natively; the tick detects `INBOX` already present and marks the snooze `woken` without duplicating labels.
- 7-day testing-mode token expiry → wake actions `skipped_auth` + banner, never lost (row stays `sleeping` until a successful wake).

---

## 8. Gmail filter export

**Goal:** For senders that ignore unsubscribes, create a **native Gmail filter** (auto-archive or auto-trash) so cleanup persists even when the app isn't running.

### Backend

- `server/src/services/gmailFilterService.js` — wraps `gmail.users.settings.filters.create` with `criteria: { from }` and `action: { removeLabelIds: ['INBOX'] }` (archive) or `{ addLabelIds: ['TRASH'] }` (auto-trash). **Scope check:** filter management is covered by `gmail.modify`'s settings surface — verify against the current API reference during implementation; if a `gmail.settings.basic` scope turns out to be required, gate the feature behind an incremental-consent flow rather than expanding the default scope set.
- Track created filters in a `gmail_filters` registry table (`user_id`, `filter_id`, `sender`, `action`) so they list and delete cleanly from the app, and cascade metadata on account deletion (the Gmail-side filter belongs to the user and is *not* auto-deleted — documented explicitly).
- Routes: `GET/POST /api/gmail-filters`, `DELETE /api/gmail-filters/:id`. Protected senders refused. Audit-logged (`gmail_filter_create` / `gmail_filter_delete`).

### Frontend

- Entry points: the verification-loop escalation popover (feature #5) and the sender row menu ("Create Gmail filter…").
- Modal: sender (read-only) + action radio (Archive / Trash) + a persistent note: *"This filter lives in your Gmail settings and keeps working even when EmailDiet is off. Manage it here or in Gmail settings."*
- Filters list card on Account & Logs with per-row delete.

### Edge cases

- Gmail's 1,000-filter account limit → surface the API error with a friendly message.
- Filter already exists for the sender (created in Gmail directly) → API returns it; register instead of duplicating.

---

## 9. Inbox health score

**Goal:** A composite 0–100 dashboard score, tracked weekly in the digest.

### Design

```
score = 100
  - 30 × marketingRatio          # marketing msgs / total (scan cache)
  - 25 × unreadRatio             # unread / total
  - 25 × storagePressure         # usedBytes / quota, from storage_snapshots (quick-wins #3)
  - 20 × unsubDebtRatio          # never-read senders with unsub method / total senders (feature #1)
```

Each term clamped to [0, weight]; weights defined in one server-side constant (`HEALTH_WEIGHTS`) — single source of truth, drift-guard-tested like `FILTER_DEFS`.

### Schema

```sql
CREATE TABLE health_scores (
  id        INTEGER PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score     INTEGER NOT NULL,
  breakdown TEXT    NOT NULL,   -- JSON of the four components
  taken_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Backend

- `healthService.computeScore(userId)` — pure function over cache + snapshots + engagement (features #1 and quick-wins #3 are inputs; degrade gracefully when either is missing by renormalizing weights and flagging `partial: true`).
- Snapshot after every scan (throttled like storage snapshots). `GET /api/health?days=90` returns latest + series.
- Digest gains a **"Inbox health: 74 (+6)"** line with the top drag ("biggest factor: 38 % unread").

### Frontend

- Mailbox header stat: score ring/badge + delta vs. last week; click → breakdown popover (four bars, one per component, each linking to the tab that fixes it: Marketing → quick filters, Storage → Storage tab, etc.).
- Empty state before first scan: "Run a scan to get your inbox health score."

---

## Cross-cutting notes

- **Migrations:** seven new tables, all `user_id` FK + `ON DELETE CASCADE` (account deletion stays clean); audit-log action enum extended with `auto_rule`, `snooze`, `wake`, `triage`, `gmail_filter_create`, `gmail_filter_delete`, `verification`, `escalate`.
- **Scopes:** everything stays inside `gmail.modify` + existing scopes, with one flagged verification item (Gmail filter settings — see #8). No body reads anywhere in this tier.
- **Scheduler:** all timed work (rule keyword passes, verification checks, snooze wakes, triage passes) rides the single generic tick loop from quick-wins #2 — one loop, many queues, per-user error isolation.
- **Caps & safety:** every mutation path keeps the shipped conventions — protect-list check, per-run caps, trash-only, typed confirms > 500, audit-log entry, `skipped_auth` on expired tokens.
- **Testing:** per-feature unit tests (rule evaluation matrix, duplicate grouping, score clamping, snooze wake idempotency, filter-registry sync) + one job-manager integration test each, matching the current `node:test` layout. Follow the CLAUDE.md new-feature checklist for every item.
- **Order rationale:** #1/#2 are pure cache reads (zero risk, and #1 feeds #7 and #9); #3 before #4 so the engine is API-testable before UI; #5 depends on #3's escalation hooks; #8 closes #5's escalation path; #9 aggregates everything and ships last.
