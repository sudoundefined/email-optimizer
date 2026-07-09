# Email Optimizer

A personal web app for cleaning up your Gmail — scan for marketing clutter, bulk unsubscribe, auto-label senders, protect important contacts, and reclaim storage.

> **No database.** Gmail is the source of truth. Nothing is permanently deleted — trash is recoverable for 30 days.

## Features

| Tab | What it does |
|-----|-------------|
| **Senders** | Scan your mailbox by date range, see senders sorted by email count with unsubscribe-method badges (One-click / Email / Link / None). Select senders to unsubscribe, label, protect, keep-latest-N, or trash in bulk. |
| **Inbox** | Live counts for Gmail groups (Important, Primary, Marketing, Social, etc.) with message drill-down. Quick-filter toolbar for one-click segments like "never opened", "large >5 MB", "old attachments". |
| **Storage** | Reclaimable storage total, top 10 senders by size, storage-by-month chart, and a table of your largest attachments (>5 MB). |
| **Labels** | Manage app-created `Unsub/*` labels — remove a label (keep emails) or trash its emails and delete the label. |

**Protect-list** — Banks, utilities, and government senders are auto-protected after each scan (matched by domain and subject keywords). You can protect/unprotect any sender manually. Protected senders are excluded from bulk unsubscribe and trash actions.

## Tech stack

| Layer | Tech |
|-------|------|
| Client | React 18, Vite, TypeScript, Material UI v6, Emotion |
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
   - App name: anything (e.g. `Email Optimizer`)
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

1. Pick a date range and **Scan mailbox**.
2. Senders appear with unsubscribe-method badges:
   - **One-click** — unsubscribed automatically via HTTP POST (RFC 8058)
   - **Email** — an unsubscribe email is sent on your behalf
   - **Link** — opens the sender's unsubscribe page for you to complete
3. Select senders — a floating action tray appears with:
   - **Unsubscribe** — results stream in per-sender as they complete
   - **Label** — review suggested categories, then create and apply Gmail labels (`Unsub/<Category>`)
   - **Protect / Unprotect** — add or remove senders from the protect-list
   - **Keep latest…** — (single non-protected sender) keep the newest N emails from that sender and move the rest to Trash. Great for daily newsletters you skim but don't archive. Protected senders are refused.
   - **Move to Trash** — trash all scanned emails from selected senders (>500 emails requires typed confirmation)

### Inbox tab

- **Two-pane layout** — A master-detail view of your inbox.
- **Smart filters** — Quick segments like never opened, unread marketing, large >5 MB, old newsletters.
- **Trash all matching** — when a filter is active, move the *entire* matching set to Trash (not just the messages shown). Protected senders are automatically skipped, and the confirmation makes clear it affects every match.
- **Newsletters & Groups** — Clickable items (Important, Primary, Marketing, Social, etc.) showing counts; click to see the messages in the detail pane.

### Storage tab

- **Reclaimable storage** — total size and count of emails >500 KB
- **Storage by date** — Drill down into storage usage by year and month.
- **Top senders & Size bands** — Browse large emails by sender or size bucket.
- **Largest attachments (>5 MB)** — Default table view of your biggest emails.

### Labels tab

- **Two-pane layout** — Browse all your system, user, and app-created labels.
- **Manage App-created labels** — Remove a label (keep emails) or trash emails + delete label directly from the detail pane.

## Tests

```bash
npm test    # 66 unit tests
```

Covers: header parsing (RFC 2369/8058), mailto/MIME building with header-injection resistance, sender categorization, rate-limiter retry/backoff logic, inbox group definitions, quick-filter allow-list (client/server drift guard), keep-latest partitioning and sender-email injection guard, protect-list heuristics and persistence, and storage aggregation.

## Project structure

```
email-optimizer/
  client/                  React + Vite + MUI frontend
    src/
      components/          14 React components (all MUI)
      hooks/               useAuth, useJob custom hooks
      api.ts               API client with SSE streaming
      theme.ts             MUI theme configuration
      types.ts             TypeScript interfaces
  server/                  Express API server
    src/
      auth/                OAuth client + token storage
      gmail/               Gmail API client, rate limiter, MIME builder
      routes/              Express route handlers (auth, scan, inbox, etc.)
      services/            Business logic (scan, inbox, storage, protect, categorizer, etc.)
      jobs/                Background job manager (SSE progress streams)
      store/               In-memory caches (scan results, label registry)
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
