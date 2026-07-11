# Implementation Plan — Quick Wins (reuse existing infrastructure)

**Status:** 📋 Pending — not started (verified against codebase 2026-07-11: no `sender_watches`/`storage_snapshots` tables, watch/auto-clean services, or signed-action routes exist yet). Roadmap tier: **v8** — see [ROADMAP.md](../ROADMAP.md).

Four features that recombine shipped subsystems — the per-user metadata cache, job manager (SSE progress), weekly digest cron, retention engine (keep-latest-N), and activity audit log — without adding new external dependencies or violating core invariants (metadata-only storage, trash-only deletes, per-user tenant isolation).

Suggested build order: **1 → 3 → 2 → 4** (each step reuses pieces built in the previous one).

---

## 1. Sender watch list

**Goal:** Users mark senders as "watched." The weekly digest alerts them when a watched sender's volume spikes.

### Schema

```sql
CREATE TABLE sender_watches (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_email  TEXT    NOT NULL,           -- normalized, lowercase
  baseline_avg  REAL    NOT NULL DEFAULT 0, -- rolling weekly average
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, sender_email)
);
```

### Backend

- `POST /api/watches` / `DELETE /api/watches/:id` / `GET /api/watches` — thin CRUD, JWT-scoped by `user_id`, sender address validated with the existing Gmail-query-injection guard (same validator as keep-latest-N).
- **Digest hook:** in the weekly digest job, for each watched sender run a cached-metadata count for the past 7 days. If `count > max(baseline_avg * 2, baseline_avg + 5)`, include a "Volume spike" section in the digest. Update `baseline_avg` with an exponential moving average (`0.7 * old + 0.3 * new`) after each run.
- Audit log: record `watch_add` / `watch_remove` actions (extend the existing action enum).

### Frontend

- "Watch" toggle in the sender table row menu (next to Protect). Watched senders get a badge, filterable via the existing quick-filter toolbar pattern.
- Watches list on the Account & Logs page, reusing the paginated-table component.

### Edge cases

- Sender never seen in cache → baseline 0; first digest establishes baseline, no alert on first run.
- Protected + watched is allowed (orthogonal concepts).

### Tasks (file-level)

1. `server/src/db/db.js` — add `sender_watches` migration (table 8) + `watch_add`/`watch_remove` to the audit action enum.
2. `server/src/services/watchService.js` — new: `listWatches`, `addWatch`, `removeWatch`, `checkSpikes(userId, cache)` (all `userId` first; address validation reused from `retentionService`).
3. `server/src/routes/watches.js` — new route file; mount in `index.js`.
4. `server/src/services/digestService.js` — add a `buildSpikeSection(spikes)` pure HTML builder (escaped).
5. `server/src/jobs/…digestRunner` — call `checkSpikes` per user in the weekly run; update EMA after.
6. `client/src/api.ts` + `types.ts` — `getWatches`, `addWatch`, `removeWatch` + `SenderWatch` interface.
7. `client/src/components/MailboxTab.tsx` — "Watch" item in the sender row menu + watched badge; watched-count segment chip.
8. `client/src/components/AccountPage.tsx` — watches card (paginated-table component reuse).

### Tests

- `watchService.test.js` — CRUD tenant isolation; invalid address rejected; spike math (`count > max(2×avg, avg+5)`); EMA update (`0.7/0.3`); first-run no-alert.
- `digestService.test.js` — spike section renders escaped HTML; omitted when no spikes.

### Acceptance criteria

- [ ] Watch/unwatch from a sender row round-trips and survives reload (SQLite-persisted).
- [ ] A watched sender with 0 baseline triggers no alert on the first digest run.
- [ ] A genuine spike (e.g. baseline 3/wk → 12 this week) produces a "Volume spike" digest section.
- [ ] Deleting the account removes all watch rows (cascade verified via `db:inspect`).
- [ ] Both actions appear in the activity audit log.

---

## 2. Scheduled auto-clean rules

**Goal:** Per-user recurring rules, e.g. "every Sunday at 08:00, trash promotions older than 30 days."

### Schema

```sql
CREATE TABLE clean_rules (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  filter_key   TEXT    NOT NULL,  -- key into server FILTER_DEFS (single source of truth)
  older_than_d INTEGER,           -- optional age qualifier appended to the query
  action       TEXT    NOT NULL CHECK(action IN ('trash','archive','label')),
  label_name   TEXT,              -- required when action='label'
  day_of_week  INTEGER NOT NULL,  -- 0-6
  hour         INTEGER NOT NULL,  -- 0-23, user's tz offset stored alongside
  tz_offset    INTEGER NOT NULL DEFAULT 0,
  enabled      INTEGER NOT NULL DEFAULT 1,
  last_run_at  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Backend

- **Scheduler:** extend the existing in-process weekly-digest scheduler into a generic tick loop (check every 15 min: `enabled = 1 AND due AND (last_run_at IS NULL OR last_run_at < this slot)`). Single-job guard per user reused from the digest.
- **Execution:** each due rule enqueues a job via the existing job manager. The job composes the Gmail query from `FILTER_DEFS[filter_key]` + `older_than:${older_than_d}d`, then runs the same paged trash/archive/label pipeline as "trash all matching" — including the protected-sender skip and scan cap.
- **Safety rails:**
  - Hard cap per run (e.g. 2,000 messages) — report cap hits like trash-all-matching does.
  - `action='trash'` only ever moves to Gmail Trash (30-day recovery). Never permanent delete.
  - Dry-run mode: `POST /api/rules/:id/preview` returns the match count without acting.
- **Reporting:** every run writes an audit-log entry (`auto_clean`, with rule name, matched, acted, skipped counts). Digest gains an "Auto-clean this week" summary section.

### Frontend

- "Auto-clean" tab: rules table (name, schedule, filter, action, last run, enabled toggle) + a create/edit modal. Filter dropdown is populated from the `FILTER_DEFS` endpoint — no client-side duplication.
- Preview button in the modal shows live match count before saving.

### Edge cases

- Server downtime across a scheduled slot → run-on-next-tick if `last_run_at` predates the missed slot (same catch-up rule as the digest).
- Expired refresh token (7-day testing-mode expiry) → mark run as `skipped_auth`, surface a re-login prompt banner; never silently disable the rule.

### Tasks (file-level)

1. `server/src/db/db.js` — add `clean_rules` migration + `auto_clean` audit action.
2. `server/src/jobs/scheduler.js` — generalize the digest cron into a 15-minute tick loop with a due-work registry (digest becomes the first registrant; auto-clean the second). Keep per-user error isolation and the single-job guard.
3. `server/src/services/cleanRuleService.js` — new: CRUD + `composeQuery(rule)` (from `FILTER_DEFS[filter_key]` + `older_than:Nd`) + `runRule(userId, rule, emit, signal)` reusing the trash-all-matching pipeline.
4. `server/src/routes/rules.js` — new: CRUD + `POST /api/rules/:id/preview`; mount in `index.js`.
5. `client/src/api.ts` + `types.ts` — rule CRUD/preview methods + `CleanRule` interface.
6. `client/src/components/AutoCleanTab.tsx` — new: rules table + create/edit modal (filter dropdown from `GET /api/inbox/filters`, schedule pickers, action select, preview button, enabled toggle).
7. `client/src/App.tsx` — register the new tab/nav entry.
8. `digestService.js` — "Auto-clean this week" summary section from the audit log.

### Tests

- `cleanRuleService.test.js` — `composeQuery` matrix (each filter key × with/without `older_than`); allow-list rejection of unknown keys; due-slot math incl. tz offset and catch-up (`last_run_at` before missed slot → due).
- `scheduler.test.js` — tick registry runs due work once per slot; `skipped_auth` on token failure; no double-fire with a manual run.
- Integration: one rule end-to-end through the job manager with protected-sender skips and cap-hit reporting.

### Acceptance criteria

- [ ] A rule "Sundays 08:00, trash Old promotions older than 30 d" runs in the correct local slot and only once per week.
- [ ] Preview returns a live match count without mutating anything.
- [ ] Runs never permanently delete (Trash only), always skip protected senders, and stop at the per-run cap with an honest report.
- [ ] A missed slot (server down) executes on the next tick, not twice.
- [ ] Every run is visible in the audit log and summarized in the weekly digest.
- [ ] Disabling a rule takes effect before the next tick; deleting a user cascades its rules.

---

## 3. Storage trend tracking

**Goal:** Show "you've reclaimed X GB since Y" with a sparkline on the storage dashboard.

### Schema

```sql
CREATE TABLE storage_snapshots (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_bytes INTEGER NOT NULL,     -- from Gmail profile / usage API
  taken_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_snapshots_user_time ON storage_snapshots(user_id, taken_at);
```

### Backend

- **Capture:** at the end of every scan job (and every auto-clean run once #2 ships), fetch the mailbox usage figure already available from the profile call and insert a snapshot. Throttle: skip if the latest snapshot is < 6 hours old.
- `GET /api/storage/trend?days=90` — returns downsampled points (one per day, latest wins) plus computed `reclaimed = max(total) - latest` and `sinceDate`.
- Retention: keep 365 daily points per user; prune older rows during capture.

### Frontend

- Storage dashboard header gains a stat card: "Reclaimed 1.2 GB since March" + a small sparkline (existing chart tooling; no new chart library).
- Empty state (< 2 snapshots): "Trends appear after your next scan."

### Edge cases

- Storage can go **up** between snapshots (new mail) — `reclaimed` uses peak-to-current, floored at 0, and the sparkline shows the raw curve honestly.

### Tasks (file-level)

1. `server/src/db/db.js` — `storage_snapshots` migration + index.
2. `server/src/services/snapshotService.js` — new: `capture(userId)` (6-hour throttle, 365-day prune) + `getTrend(userId, days)` (daily downsample, `reclaimed`/`sinceDate` computation).
3. Hook `capture` at the end of `scanService.runScan` (and later `cleanRuleService.runRule`) — fire-and-forget, never fail the parent job on snapshot errors.
4. `server/src/routes/storage.js` — add `GET /api/storage/trend`.
5. `client/src/api.ts` + `types.ts` — `getStorageTrend` + `StorageTrend` interface.
6. `client/src/components/StorageTab.tsx` — stat card ("Reclaimed X since Y") + inline SVG sparkline (no new chart library; semantic-token stroke); "< 2 snapshots" empty state.

### Tests

- `snapshotService.test.js` — throttle (second capture within 6 h is a no-op); prune at 365 points; downsampling picks the latest point per day; `reclaimed = max(peak - latest, 0)`; tenant isolation.

### Acceptance criteria

- [ ] Every scan (≥ 6 h apart) adds exactly one snapshot; `db:inspect` shows per-user rows only.
- [ ] After trashing + emptying trash, the next scan's snapshot drops and the card shows a positive "reclaimed" figure.
- [ ] Growing mailboxes show reclaimed = 0 (never negative) while the sparkline rises honestly.
- [ ] Dashboard renders correctly in all four theme renderings (2 themes × light/dark).

---

## 4. Digest one-click act links

**Goal:** Action links in the weekly digest email — unsubscribe or keep-latest-N a sender directly from the inbox.

### Design

- **Token:** short-lived (7-day), single-use, HMAC-signed JWT embedding `{ user_id, action, sender_email, jti }`. Signed with the existing JWT secret; `jti` recorded in a `used_action_tokens` table (or reuse the audit log with a uniqueness check) to enforce single use.
- **Endpoint:** `GET /api/digest/act?token=...`
  1. Verify signature + expiry + unused `jti`.
  2. Re-check invariants at click time: sender not protected, unsubscribe method still known.
  3. Execute via the existing unsubscribe pipeline or retention engine.
  4. Mark `jti` used, write audit-log entry (`digest_act`), render a minimal confirmation page ("Unsubscribed from X — undo window info").
- **Digest template:** each sender row gains two buttons: "Unsubscribe" and "Keep latest 5." URLs point at the app's public origin. All sender-derived content stays HTML-escaped (existing rule).

### Safety

- GET-triggered mutation is acceptable *only* because the token is single-use and unguessable; add a lightweight interstitial confirm page for `keep-latest` (destructive) while unsubscribe executes directly.
- Mail-client link prefetchers: require one click on the confirmation page for any destructive action (prefetches won't consume the token because verification happens on the confirm POST).
- Rate-limit the endpoint per IP + per user with the existing limiter.

### Edge cases

- Token clicked after user deleted account → cascade removed rows; return a friendly "link expired" page.
- Sender already unsubscribed since digest was sent → idempotent success message.

### Tasks (file-level)

1. `server/src/db/db.js` — `used_action_tokens` table (`jti` UNIQUE, `user_id` FK cascade) + `digest_act` audit action.
2. `server/src/services/actionTokenService.js` — new: `sign({ userId, action, sender })` (7-day exp, random `jti`) + `verifyAndConsume(token)` (signature, expiry, unused-`jti` check in one transaction).
3. `server/src/routes/digestAct.js` — new: `GET /api/digest/act` (renders confirm page for destructive actions; executes unsubscribe directly) + `POST /api/digest/act/confirm` (consumes the token — prefetch-safe); rate-limited with the existing limiter; mount in `index.js` *outside* the JWT auth middleware (the token is the credential) but inside the global rate limit.
4. `server/src/services/digestService.js` — per-sender "Unsubscribe" / "Keep latest 5" buttons in the digest template, URLs on the public origin, all content escaped.
5. Minimal server-rendered confirmation/expired/success pages (no client-app dependency — must work in any mail client's browser).

### Tests

- `actionTokenService.test.js` — round-trip verify; tampered signature rejected; expired rejected; second consume of the same `jti` rejected; cross-user token cannot act on another user's data.
- `digestAct.test.js` (route) — GET on a `keep-latest` token renders confirm (does **not** consume); confirm POST consumes and executes; protected-sender re-check at click time refuses; deleted-account token → friendly expiry page.

### Acceptance criteria

- [ ] Clicking "Unsubscribe" in the digest completes the unsubscribe and shows a confirmation page — with no app login required.
- [ ] The same link clicked twice shows "already used"; a link prefetcher (GET-only) never consumes a destructive token.
- [ ] "Keep latest 5" always interposes one explicit confirm click.
- [ ] Tokens for senders protected *after* the digest was sent are refused at click time.
- [ ] Every executed action lands in the audit log as `digest_act` with the sender and outcome.

---

## Cross-cutting notes

- **Migrations:** three new tables + one action-enum extension; all follow the existing `user_id` FK + cascade-delete pattern, so account deletion stays clean.
- **No new scopes:** everything runs within `gmail.modify` + existing profile scope.
- **Testing:** each feature gets unit tests around its query composition/token verification plus one integration test through the job manager, matching the current test layout.
- **Order rationale:** #1 and #3 are pure additive reads (lowest risk), #2 introduces scheduled writes (needs #1's digest-section plumbing), #4 depends on the digest template changes from #1/#2.
- **What this tier unlocks:** the generic scheduler tick (#2), digest-section plumbing (#1), signed action tokens (#4), and storage snapshots (#3) are direct prerequisites for the rules & automation tier — see [PLAN-NEXT.md](PLAN-NEXT.md).
- **Definition of done (per feature):** all acceptance criteria checked, `npm test -w server` green, `npm run build -w client` clean, FEATURES.md + ARCHITECTURE.md updated (per the CLAUDE.md new-feature checklist), and the item moved to Shipped in ROADMAP.md.
