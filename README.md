# EmailDiet

A personal web app for cleaning up your Gmail — scan for marketing clutter, bulk unsubscribe, auto-label senders, protect important contacts, and reclaim storage.

> **No database.** Gmail is the source of truth. Nothing is permanently deleted — trash is recoverable for 30 days.

## Features

| Tab | What it does |
|-----|-------------|
| **Senders** | Scan your mailbox by date range, see senders sorted by email count with unsubscribe-method badges (One-click / Email / Link / None). Select senders to unsubscribe, label, protect, keep-latest-N, or trash in bulk. |
| **Inbox** | Live counts for Gmail groups (Important, Primary, Marketing, Social, etc.) with message drill-down. Quick-filter toolbar for one-click segments like "never opened", "large >5 MB", "old attachments". |
| **Storage** | Reclaimable storage total, top 10 senders by size, storage-by-month chart, and a table of your largest attachments (>5 MB). |
| **Labels** | Manage app-created `Unsub/*` labels — remove a label (keep emails) or trash its emails and delete the label. |

**Weekly digest** — Opt into a scheduled weekly email (from your own Gmail) listing new marketing senders that started emailing you, each with an unsubscribe link. Open it from the schedule (clock) icon in the top bar. The first run seeds a baseline silently; later runs report only genuinely new senders. Reliable scheduling needs production OAuth — see [docs/OAUTH_VERIFICATION.md](docs/OAUTH_VERIFICATION.md).

**Protect-list** — Banks, utilities, and government senders are auto-protected after each scan (matched by domain and subject keywords). You can protect/unprotect any sender manually. Protected senders are excluded from bulk unsubscribe and trash actions.

## Tech stack

| Layer | Tech |
|-------|------|
| Client | React 18, Vite, TypeScript, Chakra UI v2, Framer Motion |
| Server | Node.js, Express, Google Gmail API |
| Infra | npm workspaces monorepo, no database |

## Prerequisites

- **Node.js** 18+ and npm
- A **Google Cloud** project with the Gmail API enabled and OAuth 2.0 credentials (see setup below)

## Google Cloud setup (~5 minutes, one-time)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services > Library** — search "Gmail API" and enable it.
3. **APIs & Services > OAuth consent screen**:
   - User type: **External**
   - App name: anything (e.g. `EmailDiet`)
   - Add your email as support and developer contact
   - Leave publishing status as **Testing**
4. **Audience > Test users** — add your Gmail address.
5. **Credentials > Create credentials > OAuth client ID**:
   - Type: **Web application**
   - Authorized redirect URI: `http://localhost:3001/api/auth/callback`
6. Copy the **Client ID** and **Client Secret**.

> **Testing mode caveats:**
> - First sign-in shows "Google hasn't verified this app" — click *Continue*.
> - Refresh tokens expire after ~7 days; just sign in again when prompted.

## Install & run

```bash
# Install dependencies (both client and server)
npm install

# Configure OAuth credentials
cp server/.env.example server/.env
# Edit server/.env and fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

# Start dev servers (API on :3001, app on :5173)
npm run dev
```

Open **http://localhost:5173** and sign in with Google.

## Usage

### Senders tab

1. Pick a date range and the app will **Auto-Scan** your mailbox (or click **Scan mailbox**).
2. Senders appear with unsubscribe-method badges:
   - **One-click** — unsubscribed automatically via HTTP POST (RFC 8058)
   - **Email** — an unsubscribe email is sent on your behalf
   - **Link** — opens the sender's unsubscribe page for you to complete
3. Select senders — a floating action tray appears with:
   - **Unsubscribe** — results stream in per-sender as they complete
   - **Label** — review suggested categories (18-category taxonomy: Work, Banking, Shopping, Travel, Medical, Tax, Bills, Subscriptions, Newsletters, Social, Promotions, Personal, Education, Entertainment, Food & Dining, Real Estate, Health & Fitness, Investing), then create top-level Gmail labels and **tag in place** — nothing leaves your inbox unless you tick *Also archive*.
   - **Protect / Unprotect** — add or remove senders from the protect-list
   - **Keep latest…** — (single non-protected sender) keep the newest N emails from that sender and move the rest to Trash. Great for daily newsletters you skim but don't archive. Protected senders are refused.
   - **Move to Trash** — trash all scanned emails from selected senders (>500 emails requires typed confirmation)

### Inbox tab

- **Two-pane layout** — A master-detail view of your inbox.
- **Smart filters** — Quick segments like never opened, unread marketing, large >5 MB, old newsletters.
- **Trash all matching** — when a filter is active, move the *entire* matching set to Trash (not just the messages shown). Protected senders are automatically skipped, and the confirmation makes clear it affects every match.
- **Newsletters & Groups** — Clickable items (Important, Primary, Marketing, Social, etc.) showing counts; click to see the messages in the detail pane.

### Storage tab

- **Reclaimable storage** — total size and count of emails >250 KB
- **Storage by date** — Drill down into storage usage by year and month.
- **Top senders & Size bands** — Browse large emails by sender or size bucket.
- **Largest attachments (>5 MB)** — Default table view of your biggest emails.

### Labels tab

- **Two-pane layout** — Browse all your system, user, and app-created labels.
- **Manage App-created labels** — Remove a label (keep emails) or trash emails + delete label directly from the detail pane.
- **Label Grouping** — Labels are neatly organized into collapsible accordions for System, App-Created, and User Labels.

### Universal Table Enhancements

- **Consistent Pagination** — All data tables (Mailbox Drill Panel, Protected Tab, Label Manager emails) support robust pagination.
- **Premium Aesthetics** — Sentence Case headers with `brand.50` background, `UpDownIcon` sort indicators, left border selection highlights (no row background shifts), and subtle 1px bottom borders for readability.
- **Concept Loaders** — Uses a custom Framer Motion "scanning envelope" loader (`EmailLoader`) for async operations.
- **Overflow Protection** — Tooltips for long email addresses are strictly constrained to 400px with wrapping, ensuring they never stretch off-screen.

### Weekly digest (schedule icon)

- Click the **clock icon** in the top bar to open **Weekly digest** settings.
- **Enable** it, choose a **day/hour** and optional **recipient** (blank = your own account), and **Save**.
- **Preview** shows which new senders would be included (sends nothing); **Send now** runs immediately.
- The **first run seeds a baseline** and sends nothing; later runs report only senders that appear afterward.
- Scheduled runs need the app running and a valid sign-in — reliable weekly delivery requires production OAuth (see [docs/OAUTH_VERIFICATION.md](docs/OAUTH_VERIFICATION.md)).

## Tests

```bash
npm test    # 105 unit tests
```

Covers: header parsing (RFC 2369/8058), mailto/MIME building with header-injection resistance, sender categorization (expanded 18-category taxonomy), recurring-subscription detection, rate-limiter retry/backoff logic, inbox group definitions, quick-filter allow-list (single-source FILTER_DEFS), keep-latest partitioning and sender-email injection guard, digest store/settings/baseline, digest builders (XSS-safe HTML + MIME), scheduler due-logic, protect-list heuristics and persistence, and storage aggregation.

## Project structure

```
emaildiet/
  client/                  React + Vite + Chakra UI frontend
    src/
      components/          React components (all Chakra UI)
      hooks/               useAuth, useJob custom hooks
      api.ts               API client with SSE streaming
      theme.ts             Chakra UI theme configuration
      types.ts             TypeScript interfaces
  server/                  Express API server
    src/
      auth/                OAuth client + token storage
      gmail/               Gmail API client, rate limiter, MIME builder
      routes/              Express route handlers (auth, scan, inbox, digest, legal, etc.)
      services/            Business logic (scan, inbox, storage, protect, retention, digest, etc.)
      jobs/                Background job manager + weekly-digest scheduler
      store/               Caches + persistence (scan, label registry, digest state)
      index.js             Entry point
    data/                  Runtime data (gitignored)
    .env                   OAuth credentials (gitignored)
```

## Security

- `server/.env` and `server/data/` are gitignored — never commit credentials or tokens.
- The app only moves email to Trash; there is no permanent-delete call.
- One-click unsubscribe POSTs are restricted to HTTPS URLs and block private/loopback addresses.
- Header-injection attacks in mailto unsubscribe flows are sanitized.

## License

MIT
