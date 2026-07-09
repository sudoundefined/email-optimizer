# Email Optimizer Roadmap

This app started as a Gmail bulk-unsubscriber. The roadmap below charts its evolution into a full **email optimizer** — an AI-powered tool that cleans up inbox clutter, automates organization, and speeds up communication.

Each tier builds on the previous one. Features are grouped by theme and ordered roughly by value/effort ratio. Benchmarks: **Clean Email** (bulk cleaning), **SaneBox** (priority triage), **Spark** & **Shortwave** (AI drafting).

---

## ✅ Shipped

### Core cleanup (v1)
- **Bulk unsubscribe** — RFC 8058 one-click, mailto automation, manual link surfacing
- **Sender scan** — group by sender, show counts & unsubscribe methods, date-range filtering
- **Auto-categorization** — heuristic-based labeling (Promotions, Newsletters, Social, Shopping, Finance, Travel)
- **Label management** — create `Unsub/*` labels, remove labels, trash emails + delete label
- **Per-sender trash** — move all scanned emails from selected senders to Gmail Trash (30-day recovery)

### Inbox overview (v2)
- **Two-pane layout** — left pane for quick-filter and groups navigation, right pane for message lists.
- **Live inbox groups** — Important, Primary, Marketing, Social, Updates, Forums, Starred, Unread.
- **Message drill-down** — click a group or filter to see its 25 most recent messages in the detail pane.

### Protection, filters & storage (v3)
- **Sender protect-list** — auto-protect banks/utilities/government (domain + subject heuristics) plus manual protect/unprotect; protected senders are excluded from bulk unsubscribe and trash
- **Quick-filter toolbar** — one-click inbox segments (never opened, unread marketing/social, old newsletters, large >5 MB, old attachments, old promotions/forums)
- **Storage recovery dashboard** — reclaimable storage total (>500 KB emails), drill-down by date, top senders and size bands, and a largest attachments table
- **Labels master-detail** — comprehensive manager for system, user, and app-created labels with removal and bulk-trash capabilities

### Retention & sweepers (v4)
- **Keep latest N** — per-sender retention: keep the newest N emails from a sender and move the rest to Trash. Available from the Senders tray when a single non-protected sender is selected. Protected senders are refused; sender address is validated to prevent Gmail-query injection.
- **Trash all matching (filters)** — the Inbox quick-filters can move the *entire* matching set to Trash (not just the visible sample), paged server-side. Protected senders are automatically skipped, and the result reports how many were skipped or whether the 10k scan cap was hit.

---

## 🚀 Now (no AI, high value)

**Scheduled & digest**
- **Scheduled re-scan** — weekly cron job: scan for new marketing senders, generate a digest email listing them (with one-click unsubscribe links). Prevents inbox creep.
- **Weekly digest email** — "You got mail from 12 new marketing senders this week. Unsubscribe or label them:" followed by sender list with inline action links.

---

## 🔄 Next (rules & automation)

**Auto-rules engine**
- **Conditional actions** — "When a new marketing sender appears → auto-label Promotions + archive" or "When a sender I've unsubscribed from emails again → auto-trash + notify me."
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

**Summaries & drafting**
- **One-line summaries** — each inbox group gets a Claude-generated summary: "Marketing: 3 sales, 2 new product launches. Social: 1 LinkedIn message, 4 Twitter notifications."
- **Thread summaries** — click a conversation → "This 8-email thread is about: [Claude's 2-sentence summary]."
- **Smart reply panel** — suggest 3 one-click replies per email (like Gmail's Smart Reply but better). Full drafting for longer responses.

**Natural-language commands**
- **Conversational cleanup** — type "trash everything from job boards older than a year" and Claude translates it into the right queries + confirms before executing.
- **Bulk actions via chat** — "Unsubscribe me from all fitness newsletters I haven't opened in 6 months."

---

## 🌐 Platform (scalability & reach)

**Multi-account**
- **Account switcher** — manage 2+ Gmail accounts (personal, work) in one app. Unified inbox view optional.
- **Cross-account rules** — "Auto-forward receipts from personal Gmail to work Gmail."

**Beyond Gmail**
- **Outlook adapter** — OAuth + Microsoft Graph API. Same UX, different backend.
- **IMAP fallback** — for non-Gmail/Outlook providers (Yahoo, custom domains). Slower but universal.

**Publishing & polish**
- **Verified app status** — move OAuth app from Testing to Production. Requires Google verification process (~2 weeks). Benefit: no 7-day token expiry.
- **Desktop notifications** — browser notifications for new mail in protected senders or SaneLater digest ready.
- **Dark mode** — CSS variables + OS theme detection.

---

## Implementation notes

**AI integration cost**
- Claude API calls aren't free. For AI features (Later tier), consider:
  - **Tiered access** — free tier gets heuristic categorizer, paid tier gets AI.
  - **Batch processing** — summarize 50 emails at once to reduce API calls.
  - **Caching** — store AI-generated summaries in a lightweight local DB (SQLite) to avoid re-analyzing the same thread.

**Testing-mode → Production OAuth**
- Google's verification process requires:
  - Privacy policy URL
  - Terms of service URL
  - OAuth scopes justification (explain why you need `gmail.modify`)
  - Security assessment questionnaire
- Estimated timeline: 2-4 weeks after submission.

**Performance at scale**
- Current design (no DB, Gmail as source of truth) works well for personal use (<50k emails).
- For power users (100k+ emails), consider:
  - **Incremental scan** — only scan new mail since last run.
  - **Local index** — SQLite cache of sender metadata to speed up re-scans.

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

**Quick wins** (Now tier): scheduled digest of new marketing senders.  
**Moat-builders** (Next tier): Auto-rules engine, engagement stats.  
**Moonshots** (Later tier): AI summaries, natural-language commands.

---

## Feedback & contributions

This is a living roadmap. If you're using this app and have ideas, open an issue or PR. Priority is shaped by what people actually ask for, not just what sounds cool on paper.
