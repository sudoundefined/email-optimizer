# EmailDiet Roadmap

This app started as a Gmail bulk-unsubscriber. The roadmap below charts its evolution into a full **EmailDiet** — an AI-powered tool that cleans up inbox clutter, automates organization, and speeds up communication.

Each tier builds on the previous one. Features are grouped by theme and ordered roughly by value/effort ratio. Benchmarks: **Clean Email** (bulk cleaning), **SaneBox** (priority triage), **Spark** & **Shortwave** (AI drafting). Feature details live in [FEATURES.md](FEATURES.md).

---

## ✅ Shipped

### Core cleanup (v1)
- **Bulk unsubscribe** — RFC 8058 one-click, mailto automation, manual link surfacing
- **Sender scan** — group by sender, show counts & unsubscribe methods, date-range filtering
- **Auto-categorization** — heuristic 18-category taxonomy; tags in place by default with an opt-in "also archive"
- **Label management** — create top-level (or `Unsub/*`) labels, remove labels, trash emails + delete label
- **Per-sender trash** — move all scanned emails from selected senders to Gmail Trash (30-day recovery)

### Inbox overview (v2)
- **Two-pane layout** — left pane for quick-filter and groups navigation, right pane for message lists
- **Live inbox groups** — Important, Primary, Marketing, Social, Updates, Forums, Starred, Unread
- **Message drill-down** — click a group or filter to see its most recent messages in the detail pane

### Protection, filters & storage (v3)
- **Sender protect-list** — auto-protect banks/utilities/government (domain + subject heuristics) plus manual protect/unprotect; protected senders are excluded from bulk unsubscribe and trash
- **Quick-filter toolbar** — one-click inbox segments (never opened, unread marketing/social, old newsletters, large >5 MB, old attachments, old promotions/forums)
- **Storage recovery dashboard** — reclaimable storage total, drill-down by date, top senders and size bands, largest attachments table
- **Labels master-detail** — comprehensive manager for system, user, and app-created labels with removal and bulk-trash capabilities

### Retention & sweepers (v4)
- **Keep latest N** — per-sender retention: keep the newest N emails from a sender and move the rest to Trash. Protected senders refused; sender address validated against Gmail-query injection.
- **Trash all matching (filters)** — quick-filters can move the *entire* matching set to Trash, paged server-side, skipping protected senders and reporting skips / scan-cap hits.

### Scheduling & digest (v5)
- **Weekly digest email** — in-process weekly scheduler scans for **new** marketing senders vs. a persisted baseline and emails a summary from your own Gmail, each with an unsubscribe link. Configurable day/hour/recipient, preview, and send-now. HTML-escaped sender content; single-job guard.
- **OAuth verification assets** — public privacy/terms pages (`/legal/*`) and a submission guide (`docs/OAUTH_VERIFICATION.md`) for the Testing → Production move.

### Labels & subscriptions (v6)
- **Expanded label taxonomy + tag-only/archive** — 18 top-level categories, previewed and applied without moving mail by default; opt-in archive removes `INBOX` (recoverable in All Mail)
- **Subscriptions detector** — shared `RECURRING_VENDORS` list detects recurring paid services from scan metadata with monthly/annual cadence; heuristic and cache-only — no AI, no extra Gmail calls
- **Custom query labeling** — label arbitrary Gmail search results with a custom label

### Multi-user SaaS & polish (v7)
- **Multi-user re-architecture** — SQLite (WAL) with per-user tenant isolation (`user_id` FKs, cascade delete), JWT cookie sessions, AES-256-GCM token encryption at rest, per-user rate limiting
- **SaaS landing page & auth** — premium landing page for visitors, Google OAuth with CSRF state checking and HTTP-only signed JWT cookies
- **Account & Logs page** — profile card, per-user scan preferences, paginated activity audit log (`scan`, `unsubscribe`, `trash`, `label`, `keep_latest`, `login`, `logout`), account deletion with cascade, DB CLI inspector
- **Empty Trash** — one-click permanent purge of Gmail Trash with streamed progress (the only permanent-delete path)
- **Excel export** — client-side SheetJS export of filtered/selected senders
- **Dark mode & themes** — full dark/light color modes across two curated themes (Botanical Forest, Espresso) via Chakra semantic tokens; toggles in the sidebar (see [DESIGN.md](DESIGN.md))
- **UI polish & universal pagination** — premium typography, consistent loaders, pagination across all tables
- **Housekeeping** — bundle split via Vite `manualChunks` (no chunk over 500 KB); server `FILTER_DEFS` is the single source of truth for quick-filters

---

## 🔄 Next (rules & automation)

**Auto-rules engine**
- **Conditional actions** — "When a new marketing sender appears → auto-label Promotions + archive" or "When a sender I've unsubscribed from emails again → auto-trash + notify me." *The per-user unsubscribe audit log (shipped, v7) is the data source for the re-subscribe detector.*
- **Rule builder UI** — visual IF-THEN editor (think Gmail filters + Zapier simplicity). Triggers: new sender, sender type, keyword in subject. Actions: label, archive, trash, unsubscribe.

**Priority triage (SaneBox-style)**
- **SaneLater concept** — auto-file low-priority mail to `Unsub/Later` (or a custom label). Train it by dragging senders between Inbox and Later.
- **Snooze** — "Remind me about this thread in 3 days." Temporarily removes from view, resurfaces at the scheduled time.

**Engagement stats**
- **Never-read report** — analyze `UNREAD` ratios over time to surface senders you subscribe to but never open. One-click "unsubscribe from all never-read senders."
- **Open-rate heatmap** — per-sender open rate (% of emails you actually read). Sort by lowest-open to find dead subscriptions.

---

## 🤖 Later (AI-powered, needs Claude API integration)

**Smart classification**
- **AI categorizer** — replace heuristic category assignment with Claude API calls. More accurate, handles edge cases (e.g., "invoice from Stripe" → Finance, "Stripe blog" → Newsletters).
- **Priority scoring** — Claude analyzes subject + snippet to rank inbox by urgency/importance (like Shortwave's "Focus Inbox").

**Content extraction (deferred — needs Claude API + email-body reads)**
- **Expense & Finance tracker** — extract purchases (food, travel, shopping, bills) with merchant/amount/date from receipts and statements; aggregate spend by month and category.
- **Career extractor** — surface offer letters, interview invites, certifications, recruiter messages, promotion emails, and performance reviews with a one-line summary each.
- Both build on a shared batched, prompt-cached extraction service. The subscriptions detector already ships heuristically (v6); an AI pass could add amounts/renewal dates later.

**Summaries & drafting**
- **One-line summaries** — each inbox group gets a Claude-generated summary: "Marketing: 3 sales, 2 new product launches. Social: 1 LinkedIn message, 4 Twitter notifications."
- **Thread summaries** — click a conversation → "This 8-email thread is about: [Claude's 2-sentence summary]."
- **Smart reply panel** — suggest 3 one-click replies per email (like Gmail's Smart Reply but better). Full drafting for longer responses.

**Natural-language commands**
- **Conversational cleanup** — type "trash everything from job boards older than a year" and Claude translates it into the right queries + confirms before executing. *The `filterMessages(query)` substrate already exists.*
- **Bulk actions via chat** — "Unsubscribe me from all fitness newsletters I haven't opened in 6 months."

---

## 🌐 Platform (scalability & reach)

**Multi-account**
- **Account switcher** — manage 2+ Gmail accounts (personal, work) per user. Unified inbox view optional.
- **Cross-account rules** — "Auto-forward receipts from personal Gmail to work Gmail."

**Beyond Gmail**
- **Outlook adapter** — OAuth + Microsoft Graph API. Same UX, different backend.
- **IMAP fallback** — for non-Gmail/Outlook providers (Yahoo, custom domains). Slower but universal.

**Publishing & polish**
- **Production OAuth verification** — move the app from Testing to Production (~2–4 weeks Google process). Removes the 7-day token expiry and unblocks reliable scheduled digests. **Assets ready:** `/legal/*` pages and `docs/OAUTH_VERIFICATION.md`.
- **Desktop notifications** — browser notifications for new mail in protected senders or SaneLater digest ready.
- **OS `prefers-color-scheme` sync** — color mode currently defaults to light with a manual toggle; optionally honor the OS preference on first load.
- **Postgres migration path** — SQLite (WAL) is fine for a single node; document/plan the move to Postgres for horizontal scaling.

---

## Implementation notes

**AI integration cost**
- Claude API calls aren't free. For AI features (Later tier), consider:
  - **Tiered access** — free tier gets heuristic categorizer, paid tier gets AI.
  - **Batch processing** — summarize 50 emails at once to reduce API calls.
  - **Caching** — store AI-generated summaries in the existing SQLite DB to avoid re-analyzing the same thread.

**Testing-mode → Production OAuth**
- Google's verification process requires:
  - Privacy policy URL *(shipped at `/legal/*`)*
  - Terms of service URL *(shipped at `/legal/*`)*
  - OAuth scopes justification (explain why you need `gmail.modify`)
  - Security assessment questionnaire
- Estimated timeline: 2-4 weeks after submission. See [docs/OAUTH_VERIFICATION.md](docs/OAUTH_VERIFICATION.md).

**Performance at scale**
- Current design (SQLite for app state, Gmail as source of truth for mail) works well for personal use (<50k emails).
- For power users (100k+ emails), consider:
  - **Incremental scan** — only scan new mail since last run.
  - **Local index** — cache sender metadata in SQLite to speed up re-scans.

**Outlook/IMAP adapter**
- Outlook: Microsoft Graph API has similar capabilities to Gmail API (labels = folders, threads, etc.). Main work is OAuth + API translation layer.
- IMAP: More limited — no categories, slower, no native unsubscribe header parsing. Fallback only.

---

## Prioritization framework

When choosing what to build next, weigh:
1. **User pain** — does this solve a frequent, annoying problem?
2. **Differentiation** — can existing tools (Gmail filters, SaneBox) already do this?
3. **Complexity** — can we ship an MVP in 1-2 weeks?
4. **Monetization** — does this justify a paid tier?

**Moat-builders** (Next tier): Auto-rules engine, engagement stats.
**Moonshots** (Later tier): AI summaries, natural-language commands.

---

## Feedback & contributions

This is a living roadmap. If you're using this app and have ideas, open an issue or PR. Priority is shaped by what people actually ask for, not just what sounds cool on paper.