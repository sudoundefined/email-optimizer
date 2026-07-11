# EmailDiet — Feature Guide & Roadmap

**Last updated:** 2026-07-10
**Status:** Multi-User SaaS Production Release · full unit-test suite passing (`npm test -w server`) · clean production build

This document is the single reference for **what the app does**, **how to use each feature**, and **what's still pending**. For architecture internals see [ARCHITECTURE.md](ARCHITECTURE.md); for styling rules see [DESIGN.md](DESIGN.md); for setup see [README.md](README.md).

---

## Table of contents

1. [Getting started & Multi-User SaaS Architecture](#getting-started--multi-user-saas-architecture)
2. [Shipped features (detailed)](#shipped-features)
   - [SaaS Landing Page & Authentication](#0-saas-landing-page--authentication)
   - [Account & Logs page](#0a-account--logs-page)
   - [Sender scanning](#1-sender-scanning)
   - [Smart unsubscribe](#2-smart-unsubscribe)
   - [Auto-categorization & labels](#3-auto-categorization--labels)
   - [Subscriptions detector](#3a-subscriptions-detector)
   - [Sender protect-list](#4-sender-protect-list)
   - [Per-sender trash](#5-per-sender-trash)
   - [Keep-latest-N retention](#6-keep-latest-n-retention)
   - [Quick-filter toolbar & message drill-down](#7-quick-filter-toolbar--message-drill-down)
   - [Trash-all-matching](#8-trash-all-matching)
   - [Storage recovery dashboard](#9-storage-recovery-dashboard)
   - [Empty Trash (permanent)](#10-empty-trash-permanent)
   - [Label manager](#11-label-manager)
   - [Weekly digest (scheduled)](#12-weekly-digest-scheduled)
   - [Excel export](#13-excel-export)
   - [Custom query labeling](#14-custom-query-labeling)
3. [Safety & Security model](#safety-model)
4. [Pending / Roadmap](#pending--todo)

---

## Getting started & Multi-User SaaS Architecture

```bash
npm install
cp server/.env.example server/.env   # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, TOKEN_ENCRYPTION_KEY
npm run dev                          # API on :3001, app on :5173
```

Open **http://localhost:5173** and connect your Google account securely.

> **Multi-User Tenant Isolation & Safety:** EmailDiet runs on a multi-user SQLite database (`emaildiet.db`) configured in `WAL` concurrency mode. Every user account is strictly isolated by foreign keys (`user_id`, `ON DELETE CASCADE`). Your Google OAuth tokens are encrypted at rest with **AES-256-GCM** (NIST SP 800-38D 12-byte IVs). Every cleanup action moves mail to **Gmail Trash** (recoverable for 30 days); the only permanent-delete path is the explicit [Empty Trash](#10-empty-trash-permanent) action.

The UI features a **SaaS Landing Page** for unauthenticated users and four core tabs in a persistent sidebar: **Mailbox** (senders, filters, and messages), **Storage**, **Labels**, and **Account & Logs** — plus a **Weekly digest** schedule dialog and a **User Profile modal**. The UI supports full **Dark and Light modes** across two curated themes (Botanical Forest and Espresso — see [DESIGN.md](DESIGN.md)).

---

## Shipped features

### 0. SaaS Landing Page & Authentication

**What it does:** Displays a premium, responsive SaaS landing page to visitors before they sign in. Highlights key benefits, live trust signals, zero-permanent-deletion safety guarantees, and a one-click Google OAuth connection button.

**Security features:**
- Uses official Google OAuth 2.0 with minimal required Gmail scopes (`gmail.modify`, `gmail.send`, `userinfo.profile`, `userinfo.email`).
- Protects against CSRF via 16-byte random OAuth state checking (10-minute TTL).
- Sets HTTP-only, `SameSite=Lax` signed JWT cookies (`auth_token`, 7-day expiry), preventing client-side token theft via XSS.

### 0a. Account & Logs page

**What it does:** Clicking **Account & Logs** in the sidebar (or your Account Badge) opens the full-page **Account & Logs** view (`AccountPage.tsx`), providing control over your account identity, scanning preferences, and activity audit trail.

**Capabilities:**
- **Profile Card:** Inspect your Google OAuth connection identity, review AES-256-GCM encryption status, and sign out / revoke credentials.
- **Preferences Card:** Customize your default scan time range (`1m`, `3m`, `6m`, `1y` — default `3m`), an optional max-messages scan cap (unset = scan everything), and the Gmail label prefix (default `Unsub/`). Stored per user in the SQLite `preferences` table.
- **Activity Audit Log:** Review a paginated, scrollable history of key actions (`scan`, `unsubscribe`, `trash`, `label`, `keep_latest`, `login`, `logout`) with localized timestamps, relative time indicators, action filter chips, search, and structured details tags. Backed by the SQLite `activity_log` table.
- **Account deletion:** `DELETE /api/user/account` removes your user row — encrypted tokens, preferences, protected senders, label registry, and activity log all cascade-delete.
- **Database CLI Inspector:** Inspect all database tables from the command line with `npm run db:inspect -w server`.

### 1. Sender scanning

**What it does:** Scans your mailbox for subscription/promotional email and groups it by sender, so you see who is filling your inbox and how many emails each has sent.

**How to use:**
1. Go to the **Mailbox** tab.
2. Pick a date range: **Last month · 3 months · 6 months · 1 year · All time**.
3. The app will **Auto-Scan** your mailbox whenever you change the date range (or click **Scan mailbox**). Progress streams live (listing → fetching → grouping). A **Cancel** button appears while scanning, and cancelling reverts to the last successful range.
4. Senders appear in a two-pane view: a left **filter pane** and a right **sender table**.

**Two-pane senders layout:**
- **Left filter pane** — a search box, **segments** (All senders · With unsubscribe · No method · Subscriptions · Protected list, each with a live count), and **category chips** with counts from the categorizer.
- **Right pane** — the sender table with a **sort selector** (Most emails · Name A–Z · Most recent), an active-filter chip, and a selected-count chip.
- **Pagination** — 100 rows per page (options 50/100/200), shown only when a segment has more than one page. Select-all acts on the current page; the global selection accumulates across pages so the action tray reflects everything selected.

**Notes:**
- Scans the full matching set by default (**no message cap**). Set a cap in **Account & Logs → Preferences** (or `SCAN_MAX_MESSAGES`) to limit Gmail API usage.
- Because there's no cap, a large "All time" scan can take a while — **Cancel** stops it promptly (the abort signal short-circuits the in-flight metadata fetch).
- Results are cached in memory per user for the session; re-scan to refresh.
- After each scan, banks/utilities/government senders are **auto-protected** (see [protect-list](#4-sender-protect-list)).

**Under the hood:** `scanService.scanSenders` (cache-free core) + `runScan` (caches per user); cancellation via an `AbortController` per job threaded through `listAllMessageIds`/`getMetadata`; `POST /api/jobs/:id/cancel`.

---

### 2. Smart unsubscribe

**What it does:** Unsubscribes you from selected senders using the best method each sender supports.

**Methods (best available is chosen automatically):**
| Badge | Method | Behavior |
|-------|--------|----------|
| **One-click** | RFC 8058 HTTP POST | Fully automated, server-side. No page opens. |
| **Email** | mailto | Sends an unsubscribe email on your behalf via Gmail. |
| **Link** | Browser link | Returns the sender's unsubscribe URL for you to complete manually. |
| **None** | — | No unsubscribe method detected. |

**How to use:**
1. On the **Mailbox** tab, select one or more senders (checkboxes).
2. In the floating action tray, click **Unsubscribe**.
3. Results stream in per-sender as each completes.

**Safety:** One-click POSTs are restricted to HTTPS and block private/loopback addresses (SSRF protection). Protected senders are excluded. Every run is recorded in your [activity audit log](#0a-account--logs-page).

---

### 3. Auto-categorization & labels

**What it does:** Classifies senders into categories and creates top-level Gmail labels. By default it **tags in place** — mail stays in your inbox — with an opt-in to also archive.

**Categories (18):** Work, Banking, Shopping, Travel, Medical, Tax, Bills, Subscriptions, Newsletters, Social, Promotions, Personal, Education, Entertainment, Food & Dining, Real Estate, Health & Fitness, Investing (heuristic — domain matching, subject keywords, Gmail category labels). Falls back to *Other* when there's no signal.

**How to use:**
1. Select senders on the **Mailbox** tab.
2. Click **Label…** in the tray.
3. Review the suggested category per sender in the dialog (change any via the dropdown).
4. Optionally tick **Also archive tagged emails** to move them out of the inbox (recoverable in All Mail).
5. Confirm to create the labels and apply them (batched 1,000 messages per call). Without the archive toggle, `INBOX` is preserved — pure tagging.

**Under the hood:** `categorizer.suggestCategory` (domain → subject → Gmail-category → Other, with confidence) → `POST /api/labels/apply` with `{ assignments, archive?, topLevel? }` → `labelService.runApplyLabels`. Labels are top-level for this taxonomy flow and prefixed (`Unsub/`) for the unsubscribe-labeling flow; `archive` adds `removeLabelIds:['INBOX']` only when set. Created labels are tracked per user in the SQLite `label_registry` table.

---

### 3a. Subscriptions detector

**What it does:** Surfaces recurring paid services from your scan — Netflix, Spotify, Amazon Prime, ChatGPT/OpenAI, Adobe, Canva, GitHub, iCloud, Notion, domain renewals, and more — with an estimated cadence (monthly/annual) derived from message timing. Heuristic and cache-only (no extra Gmail calls, no AI).

**How to use:**
1. Run a scan on the **Mailbox** tab.
2. Pick the **Subscriptions** segment in the left filter pane.
3. Detected vendors appear with their cadence; the usual per-sender actions (unsubscribe, keep-latest, protect, trash) work on them via the floating tray.

**Notes:**
- Matches each sender against a shared **`RECURRING_VENDORS`** list (domain + display-name patterns) that also feeds the **Subscriptions** label category — one source of truth, so tagging and detection stay in sync.
- **Cadence** (weekly / monthly / quarterly / annual) is estimated from the average gap between a vendor's message dates — data the scan already has. No amounts (that needs email bodies / AI — deferred).
- Reads the warm scan cache, so opening the segment makes **no new Gmail calls**.

**Under the hood:** `subscriptionsService.detectSubscriptions(senders)` → `GET /api/subscriptions` (404 if no scan yet, mirroring `/senders`).

---

### 4. Sender protect-list

**What it does:** Shields important senders (banks, utilities, government, insurance) from bulk unsubscribe and trash actions.

**How it works:**
- **Auto-protect:** After every scan, senders matching known domains (Chase, IRS, PG&E, etc.) or subject keywords (statement, invoice, tax document…) are added automatically (marked `source: 'auto'`).
- **Manual:** Select any sender → **Protect** / **Unprotect** in the tray.
- Protected senders are **excluded from unsubscribe, trash, keep-latest, and filter-trash**.

**How to use:**
1. On the **Mailbox** tab, pick the **Protected list** segment to view protected senders.
2. Select senders and use **Protect** / **Unprotect** in the tray to manage entries.

The list is persisted **per user** in the SQLite `protected_senders` table (`UNIQUE(user_id, email)`), fully isolated between accounts.

---

### 5. Per-sender trash

**What it does:** Moves every scanned email from selected senders to Gmail Trash.

**How to use:**
1. Select senders on the **Mailbox** tab.
2. Click **Move to Trash** in the tray.
3. Confirm. Trashing **more than 500 emails requires typing the exact count** to confirm.

**Safety:** Protected senders are filtered out before trashing; you're told how many were excluded. Recoverable in Gmail for 30 days.

**Under the hood:** `POST /api/senders/trash` → batch `messages.batchModify` with `addLabelIds:['TRASH']`.

---

### 6. Keep-latest-N retention

*Shipped 2026-07-09.*

**What it does:** Keeps the newest **N** emails from a single sender and moves everything older to Trash. Ideal for daily newsletters you skim but never archive ("keep the last 3 from this sender").

**How to use:**
1. On the **Mailbox** tab, select **exactly one non-protected sender**. The **Keep latest…** button appears in the tray.
2. Click it, enter how many recent emails to keep (1–1000), and confirm.
3. Progress streams (scanning sender history → trashing older). A summary reports how many were kept vs. trashed.

**Notes & safeguards:**
- Only available for a **single** sender (retention is inherently per-sender).
- **Protected senders are refused.**
- The sender address is **format-validated** to prevent Gmail-query injection, and the value is quoted in the query as defense-in-depth.
- Minimum keep is **1** (you cannot use this to wipe a sender's entire history — use **Move to Trash** for that, deliberately).
- Scans up to 10,000 of the sender's most recent messages; if capped, the summary says so and you can run again.

**Under the hood:** `server/src/services/retentionService.js` → `POST /api/senders/keep-latest`. Relies on Gmail returning results newest-first; the newest N IDs are kept, the rest are batch-trashed.

---

### 7. Quick-filter toolbar & message drill-down

**What it does:** One-click cleanup segments and per-sender message browsing — integrated directly into the **Mailbox** tab (v1's standalone Inbox tab was merged here).

**Presets (10):** Never opened · Rarely read · Unread marketing · Unread social · Old newsletters · Old with attachments · Large (>5 MB) · Unread 6 mo+ · Old promotions · Old forums.

**How to use:**
1. On the **Mailbox** tab, click a filter chip in the toolbar — a sample of matching messages loads in a selectable, paginated list (50/100/200 rows per page).
2. Or click any **sender row** to drill into that sender's recent messages.
3. Select messages and **Move to Trash** via the floating tray, **or** use [Trash-all-matching](#8-trash-all-matching) to clear the whole filtered set.

**Notes:**
- Filter definitions live server-side (`FILTER_DEFS`) and are fetched via `GET /api/inbox/filters` — a single source of truth kept in sync with the client by a drift-guard test.
- The inbox groups API (`GET /api/inbox/groups` — 11 groups with live counts: Important, Primary, Marketing, Social, Updates, Forums, Starred, Unread, With attachments, Large >5 MB, Stale unread 6 mo+ — plus `GET /api/inbox/groups/:key/messages`) remains available server-side for group-based browsing.

---

### 8. Trash-all-matching

*Shipped 2026-07-09.*

**What it does:** Moves the **entire** set of messages matching an active quick-filter to Trash — not just the sample shown on screen.

**How to use:**
1. On the **Mailbox** tab, apply a quick-filter (e.g. "Old promotions").
2. Click **Trash all matching** in the results header.
3. Confirm. The dialog makes clear it affects **every** matching message, not just the visible ones.
4. The result banner reports how many were trashed, how many **protected messages were skipped**, and whether the 10k cap was hit.

**Notes & safeguards:**
- Only allow-listed filter keys are accepted — the client sends a **filter key, never a raw query**, so arbitrary Gmail queries can't be injected.
- **Protected senders are automatically skipped**: matched messages are checked against the protect-list before trashing, and skipped ones are counted.
- Server-paged up to 10,000 messages per run; re-run to clear more.

**Under the hood:** `server/src/services/inboxService.js` → `POST /api/inbox/filter/:key/trash`.

---

### 9. Storage recovery dashboard

**What it does:** Finds and helps you clear the emails eating your Gmail storage quota.

**Views:**
- **Reclaimable storage** — total MB and count of emails larger than **250 KB** (scan query: `larger:250K -in:trash -in:spam`).
- **Storage by date** — drill down by year → month.
- **Top senders** — the 10 heaviest senders by total size.
- **By size band (7 bands)** — 0–200 KB · 200–500 KB · 500 KB–1 MB · 1–5 MB · 5–10 MB · 10–25 MB · >25 MB.
- **Largest attachments (>5 MB)** — default table view.

**How to use:**
1. Go to the **Storage** tab (analysis runs on open; cached 5 minutes per user).
2. Click any sender, month, year, or size band in the left pane to browse its messages (`GET /api/storage/messages?by=…&value=…`).
3. Select messages and **Move to Trash** via the floating tray. Large message lists **paginate at 100 rows/page** (50/100/200), with select-all scoped to the current page.
4. Use **Refresh** (`POST /api/storage/refresh`) to rebuild the cache.

---

### 10. Empty Trash (permanent)

**What it does:** Permanently deletes **everything currently in Gmail Trash** in one action, reclaiming the storage immediately instead of waiting for Gmail's 30-day auto-purge.

⚠️ **This is the only permanent-delete path in the app.** It cannot be undone — Gmail cannot recover messages removed from Trash.

**Safeguards:**
- Scope is strictly `in:trash` — it only touches messages you (or Gmail) already moved to Trash. Nothing in your inbox, archive, or labels is affected.
- Runs as a background job with live streamed progress (`{ phase: 'emptying', deleted }`) and requires explicit confirmation in the UI.

**Under the hood:** `DELETE /api/messages/trash` → `empty-trash` job → `messageTrashService.emptyTrash` pages `in:trash` (1,000 IDs per batch) and calls `gmail.users.messages.batchDelete`.

---

### 11. Label manager

**What it does:** A two-pane manager for every Gmail label — system, user, and app-created (both the `Unsub/*` unsubscribe labels and the top-level category labels from [feature 3](#3-auto-categorization--labels)).

**How to use:**
1. Go to the **Labels** tab.
2. Browse and **search** labels in the left pane; they are organized into collapsible accordions (System, User, App). Each shows its message/unread counts and a badge.
3. Click any label to open its **message drill-down** in the right pane — a paginated list of the label's recent messages. Select messages and **Move to Trash** via the floating tray.
4. For an **app-created** label, the detail header also offers:
   - **Remove label** (`DELETE /api/labels/:id?mode=labelOnly`) — deletes the label but keeps the emails.
   - **Trash + delete** (`DELETE /api/labels/:id?mode=trashEmails`) — moves the label's emails to Trash and removes the label (typed confirmation for large sets).

**Under the hood:** `GET /api/labels/:id/messages` (capped and floored server-side); bulk trash reuses the shared `POST /api/messages/trash` primitive.

---

### 12. Weekly digest (scheduled)

*Shipped 2026-07-09. Scheduled runs require production OAuth — see caveat below.*

**What it does:** On a weekly schedule, scans your mailbox for **new** marketing senders (ones that started emailing you since you began using the digest) and emails you a summary from your own Gmail, each sender with an unsubscribe link.

**How to use:**
1. Click the **schedule (clock) icon** in the sidebar to open **Weekly digest** settings.
2. Toggle **Enable weekly digest**, pick a **day** and **hour**, and optionally set a **recipient** (blank = your own account address).
3. **Save settings.**
4. Use **Preview** to see which senders would be included (dry run — sends nothing), or **Send now** to run immediately.
5. The dialog shows the **last run** and a short **history**.

**How "new" is determined:**
- The **first run seeds a baseline** from your current senders and sends **nothing** — so you're never hit with a giant first email.
- Each later run reports only senders **not seen before** (and that have an unsubscribe method), then advances the baseline.
- Runs with zero new senders send no email but still advance the schedule.

**Notes & safeguards:**
- Sends from **your own Gmail** (`gmail.send`) to yourself (or your chosen recipient). Recipient is email-format validated.
- The digest HTML **escapes all sender-supplied content** (names, subjects, URLs) — no markup/link injection.
- A manual run and the scheduler **cannot double-fire** (single-job guard); the baseline advances once per run.
- The digest scan does **not** disturb your Mailbox-tab scan.
- The scheduler iterates **all users** with `digest_enabled = 1` each tick, with per-user error isolation — one user's expired token can't block another user's digest.

> ⚠️ **Scheduling caveat (OAuth):** The in-process scheduler only runs while the app is running and a valid Google sign-in exists. In **Testing-mode** OAuth, sign-in expires ~every 7 days, so a weekly cron will pause until you sign in again. If a scheduled run hits an expired token it **fails safe** (nothing sent) and retries next tick. **Production OAuth verification removes this limit** — see [docs/OAUTH_VERIFICATION.md](docs/OAUTH_VERIFICATION.md).

**Under the hood:** `digestStore` (settings + baseline in SQLite `preferences` + `digest_baseline`), `digestService` (pure diff/HTML/MIME builders), `digestRunner` (`runDigest`), `jobs/scheduler.js` (`isDigestDue`); routes `GET /api/digest`, `POST /api/digest/settings`, `POST /api/digest/run`, `POST /api/digest/preview`.

---

### 13. Excel export

**What it does:** Exports the currently visible sender list (filtered by segment, category, and search) to an Excel `.xlsx` file. Extracts email, display name, first name, last name, and domain for each sender.

**How to use:**
1. Go to the **Mailbox** tab and run a scan.
2. Optionally apply filters (segments, category chips, search box) and/or select specific senders via checkboxes.
3. Click the **download icon** (⬇) next to the Sort dropdown in the right pane toolbar.
4. The `.xlsx` file downloads instantly — no server round-trip required.

**Smart selection:**
- If you have **senders checked**, only those are exported.
- If **no senders are checked**, the entire visible/filtered list is exported.

**Columns:**
| Column | Source |
|--------|--------|
| **Email** | Sender's email address |
| **Name** | Display name from the `From` header |
| **First Name** | Split from name (everything before the first space) |
| **Last Name** | Split from name (everything after the first space) |
| **Domain** | Email domain (e.g. `linkedin.com`) |

**Filename:** `Email_export_<unix_timestamp>.xlsx`

**Notes:**
- Name splitting is best-effort: single-word names (e.g. "LinkedIn") go entirely into First Name; multi-word last names (e.g. "John van der Berg") are preserved correctly.
- Generated entirely client-side using the SheetJS (`xlsx`) library — zero additional API calls.
- Columns are auto-sized for readability.

**Under the hood:** `utils/exportExcel.ts` (`exportToExcel` + `splitName`) called from `MailboxTab.tsx`.

---

### 14. Custom query labeling

**What it does:** Applies a custom-named label to all emails matching any Smart Filter search query. The labels are registered locally so they populate the Labels tab.

**How to use:**
1. Select any **Smart Filter** from the left pane (e.g. "Unread marketing") to load the list of matching emails.
2. Click the new **Label all matching** button in the header.
3. Type a custom label name (e.g. "Promo Clean 2026"), check "Also archive tagged emails" if desired, and confirm.
4. Watch the progress bar execute the background labeling task.

**Capping and Safety:**
- To prevent API quota exhaustion, the query labeling task is capped at **5,000 messages** per run, reporting truncation honestly.
- All custom labels created are automatically saved to the local SQLite database registry, meaning they will instantly appear under the **Labels** tab for you to browse, manage, or empty-to-trash.

**Under the hood:** `runApplyLabelToFilter` inside `server/src/services/labelService.js` triggered by `POST /api/labels/apply-filter`.

---

## Safety model

The app is built around **non-destructive, recoverable** actions:

- ✅ **Trash-first; permanent delete only on explicit demand.** Every cleanup path (per-sender trash, filter trash, storage cleanup, label trash, keep-latest) moves mail to Gmail's `TRASH` label — recoverable for 30 days. The **only** permanent-delete call in the codebase is the [Empty Trash](#10-empty-trash-permanent) action (`messages.batchDelete`), which is explicitly user-triggered and scoped strictly to messages already in Trash.
- ✅ **Multi-user tenant isolation.** Every query is scoped by `req.userId` (set by JWT middleware before any route handler runs); SQLite foreign keys with `ON DELETE CASCADE` guarantee complete data isolation.
- ✅ **Tokens encrypted at rest.** OAuth tokens are stored AES-256-GCM encrypted; sessions are HTTP-only `SameSite=Lax` JWT cookies.
- ✅ **Protect-list enforced everywhere.** Unsubscribe, per-sender trash, keep-latest, and trash-all-matching all skip protected senders.
- ✅ **Typed confirmations** for large destructive actions (>500 emails on per-sender trash; large label trash sets).
- ✅ **Injection-hardened.** Sender addresses are format-validated before entering Gmail queries; filter trash accepts only allow-listed keys, never raw queries; digest HTML escapes all sender content; mailto MIME construction sanitizes headers.
- ✅ **Rate limited.** 100 req/min per IP globally, 60 req/min per user (configurable), and `p-limit(20)` with exponential backoff against the Gmail API.
- ✅ **Fail-safe on errors.** If a Gmail auth token expires mid-operation, the job errors cleanly **before** trashing anything.
- ✅ **SSRF protection** on one-click unsubscribe (HTTPS only, private/loopback blocked).
- ✅ **Audit trail.** Scans, unsubscribes, trash operations, labeling, and logins are recorded per user in the `activity_log` table.

---

## Pending / TODO

Ordered roughly by value/effort. See [ROADMAP.md](ROADMAP.md) for full context.

### 🚀 Now (no AI, high value)

- [x] **Multi-user SaaS re-architecture** — *shipped*: SQLite (WAL) + JWT cookie sessions + AES-256-GCM token encryption + per-user rate limiting + landing page + account page & audit log.
- [x] **Scheduled re-scan + weekly digest email** — *shipped 2026-07-09* (see [feature 12](#12-weekly-digest-scheduled)). Fully built; scheduled runs are reliable **once production OAuth is verified** (assets + guide in [docs/OAUTH_VERIFICATION.md](docs/OAUTH_VERIFICATION.md)).
- [x] **Expanded label taxonomy + tag-only / archive** — *shipped* (see [feature 3](#3-auto-categorization--labels)). 18 top-level categories; tags in place by default, opt-in archive.
- [x] **Subscriptions detector** — *shipped* (see [feature 3a](#3a-subscriptions-detector)). Heuristic, cache-only recurring-service detection with cadence.
- [x] **Empty Trash** — *shipped* (see [feature 10](#10-empty-trash-permanent)). One-click permanent purge of Gmail Trash with streamed progress.
- [x] **Excel export** — *shipped* (see [feature 13](#13-excel-export)). Client-side SheetJS export of filtered/selected senders.
- [x] **UI Polish & Universal Pagination** — *shipped*. Premium typography, consistent loaders, pagination across all tables, and active state highlights without row background shifts.
- [x] **Dark mode & themes** — *shipped*: full dark/light color modes across two curated themes (Botanical Forest, Espresso) via Chakra semantic tokens; toggles in the sidebar. See [DESIGN.md](DESIGN.md).

### 🔄 Next (rules & automation)

- [ ] **Auto-rules engine** — visual IF-THEN builder ("new marketing sender → auto-label + archive", "sender emails again after I unsubscribed → auto-trash + notify").
- [ ] **Priority triage (SaneBox-style)** — auto-file low-priority mail to a `Later` label; train by moving senders in/out.
- [ ] **Snooze** — hide a thread and resurface it at a scheduled time.
- [ ] **Engagement stats** — never-read report (senders you never open) and per-sender open-rate heatmap, with one-click "unsubscribe from all never-read."
- [x] **Unsubscribe audit log** — *shipped* as part of the [Account & Logs](#0a-account--logs-page) activity trail: every unsubscribe (plus scan/trash/label/login) is persisted per user in SQLite `activity_log` with structured details. This is the data source the auto-rules "re-subscribe detector" will build on.

### 🤖 Later (AI-powered — needs Claude API)

- [ ] **Expense & Finance tracker** — extract purchases/food/travel spend from receipts and statements. *Deferred:* needs the Claude API + email-body reads.
- [ ] **Career extractor** — surface offer letters, interview invites, certifications, recruiter messages, promotion emails, performance reviews. *Deferred:* needs the Claude API + email-body reads.
- [ ] **AI categorizer** — replace heuristic categories with Claude calls for edge cases (batch, cache).
- [ ] **Priority scoring** — rank inbox by urgency/importance.
- [ ] **Summaries** — one-line group summaries and thread summaries.
- [ ] **Smart reply** — 3 one-click reply suggestions per email.
- [ ] **Natural-language cleanup** — "trash everything from job boards older than a year" → translated to a query + confirm. *The `filterMessages(query)` substrate already exists.*

### 🌐 Platform (scalability & reach)

- [ ] **Production OAuth verification** — move the app from Testing to Production (~2–4 weeks Google process). Removes the 7-day token expiry and unblocks reliable scheduled digests. **Assets ready:** privacy/terms pages served at `/legal/*` and a submission guide in [docs/OAUTH_VERIFICATION.md](docs/OAUTH_VERIFICATION.md).
- [ ] **Multi-account** — manage 2+ Gmail accounts per user; optional unified inbox.
- [ ] **Outlook adapter** — OAuth + Microsoft Graph API.
- [ ] **IMAP fallback** — universal but limited (no categories, no native unsubscribe headers).
- [ ] **Desktop notifications** — for protected-sender mail or digest-ready events.
- [ ] **Postgres migration path** — SQLite (WAL) is fine for a single node; document/plan the move to Postgres for horizontal scaling.

### 🧹 Housekeeping / tech debt

- [x] **Bundle size** — *done*: `vite` `manualChunks` splits react/chakra/app; no chunk exceeds the 500 KB warning.
- [x] **Single source of truth for filters** — *done*: server `FILTER_DEFS` is authoritative; the client fetches via `GET /api/inbox/filters` (no duplicated list).
- [ ] **Incremental scan / local index** — for power users (100k+ emails), scan only new mail since last run; cache sender metadata in SQLite.
- [ ] **OS `prefers-color-scheme` sync** — color mode currently defaults to light with a manual toggle; optionally honor the OS preference on first load.

---

*This app began as a Gmail bulk-unsubscriber and is evolving into a full multi-user email optimizer (EmailDiet). Priority is shaped by what users actually ask for.*
