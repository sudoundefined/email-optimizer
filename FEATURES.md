# Email Optimizer — Feature Guide & Roadmap

**Last updated:** 2026-07-09
**Status:** All core tiers (v1–v4) shipped · 66/66 tests passing · clean production build

This document is the single reference for **what the app does**, **how to use each feature**, and **what's still pending**. For architecture internals see [DESIGN.md](DESIGN.md); for setup see [README.md](README.md).

---

## Table of contents

1. [Getting started](#getting-started)
2. [Shipped features (detailed)](#shipped-features)
   - [Sender scanning](#1-sender-scanning)
   - [Smart unsubscribe](#2-smart-unsubscribe)
   - [Auto-categorization & labels](#3-auto-categorization--labels)
   - [Sender protect-list](#4-sender-protect-list)
   - [Per-sender trash](#5-per-sender-trash)
   - [Keep-latest-N retention](#6-keep-latest-n-retention)
   - [Inbox overview & groups](#7-inbox-overview--groups)
   - [Quick-filter toolbar](#8-quick-filter-toolbar)
   - [Trash-all-matching](#9-trash-all-matching)
   - [Storage recovery dashboard](#10-storage-recovery-dashboard)
   - [Label manager](#11-label-manager)
3. [Safety model](#safety-model)
4. [Pending / TODO](#pending--todo)

---

## Getting started

```bash
npm install
cp server/.env.example server/.env   # fill in GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
npm run dev                          # API on :3001, app on :5173
```

Open **http://localhost:5173** and sign in with Google. See [README.md](README.md) for the one-time Google Cloud OAuth setup.

> **No database.** Gmail is the source of truth. The app only ever moves mail to **Trash** (recoverable for 30 days) — there is no permanent-delete call anywhere.

The UI is organized into four tabs: **Senders**, **Inbox**, **Storage**, **Labels**.

---

## Shipped features

### 1. Sender scanning

**What it does:** Scans your mailbox for subscription/promotional email and groups it by sender, so you see who is filling your inbox and how many emails each has sent.

**How to use:**
1. Go to the **Senders** tab.
2. Pick a date range (3 months / 6 months / 1 year / all time).
3. Click **Scan mailbox**. Progress streams live (listing → fetching → grouping).
4. Senders appear in a sortable table with email counts and an unsubscribe-method badge.

**Notes:**
- Scans up to 5,000 messages per run (configurable via `scanMaxMessages`).
- Results are cached in memory for the session; re-scan to refresh.
- After each scan, banks/utilities/government senders are **auto-protected** (see [protect-list](#4-sender-protect-list)).

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
1. On the **Senders** tab, select one or more senders (checkboxes).
2. In the floating action tray, click **Unsubscribe**.
3. Results stream in per-sender as each completes.

**Safety:** One-click POSTs are restricted to HTTPS and block private/loopback addresses (SSRF protection). Protected senders are excluded.

---

### 3. Auto-categorization & labels

**What it does:** Classifies senders into categories and can apply Gmail labels under an `Unsub/*` prefix.

**Categories:** Promotions, Newsletters, Social, Shopping, Finance, Travel, Other (heuristic — domain matching, Gmail category labels, subject keywords).

**How to use:**
1. Select senders on the **Senders** tab.
2. Click **Label…** in the tray.
3. Review the suggested category per sender in the dialog.
4. Confirm to create the `Unsub/<Category>` labels and apply them (batched 1,000 messages per call).

---

### 4. Sender protect-list

**What it does:** Shields important senders (banks, utilities, government, insurance) from bulk unsubscribe and trash actions.

**How it works:**
- **Auto-protect:** After every scan, senders matching known domains (Chase, IRS, PG&E, etc.) or subject keywords (statement, invoice, tax document…) are added automatically.
- **Manual:** Select any sender → **Protect** / **Unprotect** in the tray.
- Protected senders are **excluded from unsubscribe, trash, keep-latest, and filter-trash**.

**How to use:**
1. On the **Senders** tab, toggle **All Senders / Protected** to view the protected list.
2. Select senders and use **Protect** / **Unprotect** in the tray to manage entries.

The list is persisted to `server/data/protected-senders.json` (gitignored).

---

### 5. Per-sender trash

**What it does:** Moves every scanned email from selected senders to Gmail Trash.

**How to use:**
1. Select senders on the **Senders** tab.
2. Click **Move to Trash** in the tray.
3. Confirm. Trashing **more than 500 emails requires typing the exact count** to confirm.

**Safety:** Protected senders are filtered out before trashing; you're told how many were excluded. Recoverable in Gmail for 30 days.

---

### 6. Keep-latest-N retention

*Shipped 2026-07-09.*

**What it does:** Keeps the newest **N** emails from a single sender and moves everything older to Trash. Ideal for daily newsletters you skim but never archive ("keep the last 3 from this sender").

**How to use:**
1. On the **Senders** tab, select **exactly one non-protected sender**. The **Keep latest…** button appears in the tray.
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

### 7. Inbox overview & groups

**What it does:** A two-pane master-detail view of your inbox with live counts for Gmail's native groups.

**Groups (11):** Important, Primary, Marketing, Social, Updates, Forums, Starred, Unread, With attachments, Large (>5 MB), Stale unread (6 mo+).

**How to use:**
1. Go to the **Inbox** tab.
2. Click any group in the left pane to load its most recent messages in the right pane.
3. Select messages (checkboxes) and use the floating tray to **Move to Trash**.

Label-backed groups show exact counts; query-backed groups (attachments, large, stale) show Gmail estimates (prefixed with ≈).

---

### 8. Quick-filter toolbar

**What it does:** One-click inbox segments for common cleanup targets.

**Presets (10):** Never opened · Rarely read · Unread marketing · Unread social · Old newsletters · Old with attachments · Large (>5 MB) · Unread 6 mo+ · Old promotions · Old forums.

**How to use:**
1. On the **Inbox** tab, click a filter chip in the left pane.
2. The right pane shows a sample of matching messages.
3. Select individual messages to trash, **or** use [Trash-all-matching](#9-trash-all-matching) to clear the whole set.

---

### 9. Trash-all-matching

*Shipped 2026-07-09.*

**What it does:** Moves the **entire** set of messages matching an active quick-filter to Trash — not just the sample shown on screen.

**How to use:**
1. On the **Inbox** tab, apply a quick-filter (e.g. "Old promotions").
2. Click **Trash all matching** in the results header.
3. Confirm. The dialog makes clear it affects **every** matching message, not just the visible ones.
4. The result banner reports how many were trashed, how many **protected messages were skipped**, and whether the 10k cap was hit.

**Notes & safeguards:**
- Only allow-listed filter keys are accepted — the client sends a **filter key, never a raw query**, so arbitrary Gmail queries can't be injected.
- **Protected senders are automatically skipped**: matched messages are checked against the protect-list before trashing, and skipped ones are counted.
- Server-paged up to 10,000 messages per run; re-run to clear more.
- Inbox group counts refresh automatically after trashing.

**Under the hood:** `server/src/services/inboxService.js` → `trashByFilterKey` → `POST /api/inbox/filter/:key/trash`. Server-side `FILTERS` map is kept in sync with the client toolbar by a drift-guard test.

---

### 10. Storage recovery dashboard

**What it does:** Finds and helps you clear the emails eating your Gmail storage quota.

**Views:**
- **Reclaimable storage** — total MB and count of emails larger than 500 KB.
- **Storage by date** — drill down by year → month.
- **Top senders** — the 10 heaviest senders by total size.
- **By size band** — <500 KB, 500 KB–1 MB, 1–5 MB, 5–10 MB, 10–25 MB, >25 MB.
- **Largest attachments (>5 MB)** — default table view.

**How to use:**
1. Go to the **Storage** tab (analysis runs on open; cached 5 minutes).
2. Click any sender, month, year, or size band in the left pane to browse its messages.
3. Select messages and **Move to Trash** via the floating tray.
4. Use **Refresh** to rebuild the cache.

---

### 11. Label manager

**What it does:** Manages Gmail labels — with special handling for app-created `Unsub/*` labels.

**How to use:**
1. Go to the **Labels** tab.
2. Browse system, user, and app-created labels in the left pane.
3. For an app-created label, choose in the detail pane:
   - **Remove label** — deletes the label but keeps the emails.
   - **Trash emails + delete label** — moves the label's emails to Trash and removes the label.

---

## Safety model

The app is built around **non-destructive, recoverable** actions:

- ✅ **Trash only, never delete.** Every "trash" path uses Gmail's `TRASH` label. There is no `messages.delete` call in the codebase. Mail is recoverable in Gmail for 30 days.
- ✅ **Protect-list enforced everywhere.** Unsubscribe, per-sender trash, keep-latest, and trash-all-matching all skip protected senders.
- ✅ **Typed confirmations** for large destructive actions (>500 emails on per-sender trash).
- ✅ **Injection-hardened.** Sender addresses are format-validated before entering Gmail queries; filter trash accepts only allow-listed keys, never raw queries.
- ✅ **Fail-safe on errors.** If a Gmail auth token expires mid-operation, the job errors cleanly **before** trashing anything.
- ✅ **SSRF protection** on one-click unsubscribe (HTTPS only, private/loopback blocked).

---

## Pending / TODO

Ordered roughly by value/effort. See [ROADMAP.md](ROADMAP.md) for full context.

### 🚀 Now (no AI, high value)

- [ ] **Scheduled re-scan + weekly digest email** — a weekly cron that scans for new marketing senders and emails you a digest with inline unsubscribe links.
  - ⚠️ **Blocked on production OAuth.** In Testing mode, refresh tokens expire after ~7 days, so a weekly cron is unreliable. Needs Google app verification first (see below).

### 🔄 Next (rules & automation)

- [ ] **Auto-rules engine** — visual IF-THEN builder ("new marketing sender → auto-label + archive", "sender emails again after I unsubscribed → auto-trash + notify").
- [ ] **Priority triage (SaneBox-style)** — auto-file low-priority mail to a `Later` label; train by moving senders in/out.
- [ ] **Snooze** — hide a thread and resurface it at a scheduled time.
- [ ] **Engagement stats** — never-read report (senders you never open) and per-sender open-rate heatmap, with one-click "unsubscribe from all never-read."
- [ ] **Unsubscribe audit log** — persist what you unsubscribed from and when. *Foundational:* it's the missing data source the auto-rules "re-subscribe detector" depends on.

### 🤖 Later (AI-powered — needs Claude API)

- [ ] **AI categorizer** — replace heuristic categories with Claude calls for edge cases (batch 50 at a time, cache in SQLite).
- [ ] **Priority scoring** — rank inbox by urgency/importance.
- [ ] **Summaries** — one-line group summaries and thread summaries.
- [ ] **Smart reply** — 3 one-click reply suggestions per email.
- [ ] **Natural-language cleanup** — "trash everything from job boards older than a year" → translated to a query + confirm. *The `filterMessages(query)` substrate already exists.*

### 🌐 Platform (scalability & reach)

- [ ] **Production OAuth verification** — move the app from Testing to Production (~2–4 weeks Google process). Removes the 7-day token expiry and unblocks the entire scheduled/automation tier. **Soft prerequisite for the "Now" digest feature.**
- [ ] **Multi-account** — manage 2+ Gmail accounts; optional unified inbox.
- [ ] **Outlook adapter** — OAuth + Microsoft Graph API.
- [ ] **IMAP fallback** — universal but limited (no categories, no native unsubscribe headers).
- [ ] **Desktop notifications** — for protected-sender mail or digest-ready events.
- [ ] **Dark mode** — CSS variables + OS theme detection.

### 🧹 Housekeeping / tech debt

- [ ] **Doc version drift** — reconcile MUI version references (README once said v6; actual is v9.2.0).
- [ ] **Bundle size** — client bundle is ~557 KB; consider code-splitting (dynamic `import()` / manual chunks).
- [ ] **Single source of truth for filters** — server `FILTERS` map duplicates the client toolbar list (a drift-guard test prevents divergence). Could serve `FILTERS` from the server and have the toolbar fetch it.
- [ ] **Incremental scan / local index** — for power users (100k+ emails), scan only new mail since last run; cache sender metadata in SQLite.

---

*This app began as a Gmail bulk-unsubscriber and is evolving into a full email optimizer. Priority is shaped by what users actually ask for.*
