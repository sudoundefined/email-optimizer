# Email Unsubscriber

A personal web portal for cleaning up your Gmail:

- **Sign in with Google** (OAuth 2.0, your own Google Cloud project)
- **Scan** your mailbox for marketing/subscription emails, grouped by sender
- **Bulk unsubscribe** — automatic one-click (RFC 8058) and mailto unsubscribes; manual links surfaced for the rest
- **Auto-categorize** senders (Promotions, Newsletters, Social, Shopping, Finance, Travel, Other) and apply Gmail labels in bulk
- **Protect important senders** — banks, utilities, and government senders are auto-protected after each scan (and you can protect any sender manually); protected senders are excluded from bulk unsubscribe and trash
- **Quick-filter toolbar** — one-click inbox segments (never opened, unread marketing, large emails, old attachments, and more)
- **Storage recovery dashboard** — see reclaimable storage, top senders and months by size, and your largest attachments
- **Manage labels** — remove a label (keep emails) or delete the label *and* move its emails to Trash (recoverable for 30 days; nothing is permanently deleted by this app)

React (Vite) client + Express server. No database — Gmail is the source of truth.

## 1. Google Cloud setup (one-time, ~5 minutes)

1. Go to <https://console.cloud.google.com> and create a project (e.g. `email-unsubscriber`).
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (a.k.a. Google Auth Platform):
   - User type: **External**; app name: `Email Unsubscriber`; add your email as support/developer contact.
   - Leave publishing status as **Testing**.
4. Under **Audience / Test users**: add your own Gmail address.
5. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name: `local-server`.
   - Authorized redirect URI: `http://localhost:3001/api/auth/callback` (exact, no trailing slash).
6. Copy the **Client ID** and **Client Secret**.

> On first sign-in Google shows **"Google hasn't verified this app"** — that's expected for a Testing-mode app. Click *Continue* and grant the Gmail permissions.

> **Testing-mode caveat:** refresh tokens expire after ~7 days. When that happens the app shows the sign-in screen again — just sign in again.

## 2. Install & configure

```bash
npm install
copy server\.env.example server\.env   # then edit server/.env
```

Fill in `server/.env`:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

## 3. Run

```bash
npm run dev
```

- API server: <http://localhost:3001>
- App: **<http://localhost:5173>**

## 4. Usage

### Senders tab

1. **Sign in with Google** on the connect screen.
2. Pick a date range → **Scan mailbox**. Senders appear sorted by email count with an unsubscribe-method badge:
   - `One-click` — unsubscribed automatically via HTTP POST
   - `Email` — an unsubscribe email is sent for you (senders may take days to honor it)
   - `Link` — you get an *Open* button; finish on the sender's page
3. Select senders (bottom sorting tray appears) with action buttons:
   - **Unsubscribe** — per-sender results stream in as they complete
   - **Label…** — review/adjust suggested categories → **Create & apply labels**. Labels appear in Gmail as `Unsub/<Category>`.
   - **Protect / Unprotect** — add selected senders to (or remove them from) the protect-list. Protected senders are skipped by Unsubscribe and Move to Trash; if a bulk action includes protected senders, a banner tells you how many were excluded.
   - **Move to Trash** — moves all scanned emails from selected senders to Trash (30-day recovery; nothing is permanently deleted). Large deletions (>500 emails) require typing the email count to confirm.

Use the **All Senders / Protected** switcher at the top to review the protect-list. Banks, utilities, and government senders (matched by domain or by subject keywords like "statement" / "invoice") are auto-protected after each scan.

### Inbox tab

Live counts and message lists for built-in Gmail groups and all your labels:

- **Quick-filter toolbar** — one-click filters that run a Gmail query and list matching messages: never opened, rarely read, unread marketing, unread social, old newsletters, old with attachments, large (>5 MB), unread 6 mo+, old promotions, old forums.
- **Groups** — clickable cards showing email counts for Important, Primary (personal), Marketing, Social, Updates, Forums, Starred, Unread, plus smart groups (With attachments, Large >5MB, Stale unread 6mo+). Click a group to see its 25 most recent messages.
- **All Gmail labels** — complete list of system labels, your own labels, and app-created labels with their email/unread counts.

### Storage tab

Analyzes every email larger than 1 MB (outside Trash/Spam), cached for 5 minutes:

- **Reclaimable storage** — total size and count of large emails
- **Top senders by size** — bar chart of the 10 heaviest senders
- **Storage by month** — bar chart of size by month
- **Largest attachments (>5 MB)** — table of your biggest attachment-bearing emails

### Labels tab

Manage app-created `Unsub/*` labels:

- **Remove label, keep emails** — deletes only the label
- **Trash emails + delete label** — moves all its emails to Trash (30-day recovery), then deletes the label. Large deletions require typing the email count to confirm.

## 5. Tests

```bash
npm test
```

Unit tests cover the header parser (RFC 2369/8058), mailto/MIME building (incl. header-injection resistance), the categorizer, the rate limiter's retry/backoff classification, the inbox groups, the protect-list heuristics/persistence, and the storage aggregation math (52 tests).

## Manual E2E checklist

### Auth & scan
- [ ] OAuth connect → email shown in header; restart server → still connected
- [ ] Disconnect → connect screen; sign in again works
- [ ] Scan 3-month range; spot-check a few senders' badges against Gmail "Show original" headers

### Senders tab
- [ ] One-click unsubscribe on a known sender succeeds
- [ ] Mailto unsubscribe: message appears in Gmail **Sent**
- [ ] Link-only sender: *Open* button opens the unsubscribe page
- [ ] Apply labels: `Unsub/<Category>` visible in Gmail with messages tagged
- [ ] Move to Trash: selected senders' emails appear in Gmail Trash (restorable for 30 days)

### Protect-list
- [ ] After a scan, a bank/utility sender (if present) appears under the **Protected** switcher tagged **Auto**
- [ ] Select a sender → **Protect** → it moves to the Protected list tagged **Manual**
- [ ] Select a protected sender + others → **Move to Trash** → banner reports the protected one was excluded; it is not trashed
- [ ] **Unprotect** a sender → it can be trashed/unsubscribed again

### Inbox tab
- [ ] Inbox groups counts roughly match Gmail web sidebar
- [ ] Click a group (e.g. Important) → shows recent messages from that group
- [ ] All Gmail labels table lists system labels, user labels, and app-created labels with correct counts
- [ ] Click a quick-filter (e.g. Large >5 MB) → matching messages listed; **Clear filter** resets

### Storage tab
- [ ] Storage tab loads a total-MB figure and top-senders/by-month bar charts
- [ ] Largest-attachments table lists emails >5 MB; **Refresh** re-runs the analysis

### Labels tab
- [ ] Remove label (keep emails): label gone in Gmail, emails intact
- [ ] Trash emails + delete label: emails in Trash (restorable), label gone

### Error handling
- [ ] Delete `server/data/tokens.json` while running → app shows connect screen, no crash

## Security notes

- `server/.env` (OAuth secret) and `server/data/` (tokens) are gitignored — never commit them.
- The app only ever moves email to Trash; it contains no permanent-delete call.
- One-click unsubscribe POSTs are restricted to https URLs and block private/loopback addresses.
