# EmailDiet

A multi-user SaaS web app for cleaning up and optimizing your Gmail inbox. Scan subscription clutter, bulk unsubscribe, reclaim storage, organize with smart labels, protect important senders, and export data — all safely and instantly.

> [!IMPORTANT]
> **Privacy & Security First.** Full multi-user tenant isolation (SQLite WAL + `ON DELETE CASCADE`), HTTP-only JWT session cookies, AES-256-GCM OAuth token encryption at rest (NIST SP 800-38D), per-user rate limiting, and **zero email body storage** — only metadata headers are ever read. Nothing is permanently deleted: Gmail Trash is your 30-day safety net (the only permanent-delete path is the explicit Empty Trash action).

---

## Features

| Feature | Description |
| :--- | :--- |
| **SaaS Landing Page** | Responsive marketing page with trust signals and one-click Google OAuth sign-in. |
| **Smart Subscription Scanner** | Groups promotional email by sender, detects the best unsubscribe method, and classifies senders into 18 categories. Auto-scans on date-range change with live streamed progress and cancel support. |
| **Bulk One-Click Unsubscribe** | RFC 8058 one-click server-side POST (SSRF-protected), mailto emails sent via your Gmail, or manual browser links — best method chosen automatically. |
| **Protected Senders List** | Auto-shields banks, utilities, medical, and government senders from unsubscribe/trash via smart heuristics; manual protect/unprotect anytime. |
| **Keep-Latest-N Retention** | Keep only the N newest emails from a high-volume sender and trash the rest. |
| **Quick Filters & Trash-All-Matching** | 10 one-click cleanup presets (never opened, old promotions, large >5 MB, …) with per-message or whole-set trashing. |
| **Tag-Based Multi-Filter Search** | Stack filter chips (`tag:`, `from:`, `method:`, `subject:`, `is:unread`, `older_than:`, `larger:`, free text) into one search — instant on cached scan data, or compiled into a single sanitized Gmail query (view/label only). |
| **Storage Reclaimer** | Drill down by sender, year, month, or size band; batch-trash the heavy stuff. Plus explicit **Empty Trash** to reclaim space immediately. |
| **Auto-Categorization & Labels** | 18-category label taxonomy applied in place (opt-in archive), a full label manager, and custom query labeling. |
| **Subscriptions Detector** | Surfaces recurring paid services (Netflix, Spotify, …) with estimated billing cadence — heuristic, cache-only, no extra API calls. |
| **Weekly Digest Email** | Scheduled scan for new senders with a clean summary emailed from your own Gmail. |
| **Excel Export** | Instant client-side `.xlsx` download of filtered or selected senders with split name columns and domains. |
| **Account & Audit Log** | Profile, per-user preferences, and a searchable activity audit trail; full cascade account deletion. |
| **Themes & Dark Mode** | Two curated themes — *Botanical Forest* and *Espresso* — each with full light and dark variants. |

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 6, Chakra UI v2, Framer Motion, SheetJS (`xlsx`), Vitest + Testing Library |
| **Backend** | Node.js (ESM), Express, Gmail API (`googleapis`), `jsonwebtoken`, `express-rate-limit`, `p-limit` |
| **Database** | SQLite (`better-sqlite3`) in WAL mode with foreign-key cascade isolation |
| **Monorepo** | npm workspaces (`client/` + `server/`) |

## Quickstart

### Prerequisites
- Node.js 18+ and npm
- A Google Cloud project with the Gmail API enabled and OAuth 2.0 credentials (see setup below)

### Google Cloud setup (~5 minutes, one-time)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services > Library** — search "Gmail API" and enable it.
3. **APIs & Services > OAuth consent screen**:
   - User type: **External**
   - App name: anything (e.g. EmailDiet)
   - Add your email as support and developer contact
   - Leave publishing status as **Testing**
4. **Audience > Test users** — add your Gmail address.
5. **Credentials > Create credentials > OAuth client ID**:
   - Type: **Web application**
   - Authorized redirect URI: `http://localhost:3001/api/auth/callback`
6. Copy the **Client ID** and **Client Secret** into `server/.env` (below).

Required scopes: `gmail.modify`, `gmail.send`, `userinfo.profile`, `userinfo.email`

> [!NOTE]
> **Testing mode caveats:**
> - First sign-in shows "Google hasn't verified this app" — click **Continue**.
> - Refresh tokens expire after ~7 days; just sign in again when prompted.

### Setup

```bash
npm install
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=3001
HOST=127.0.0.1
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:3001/api/auth/callback
CLIENT_URL=http://localhost:5173

# Security secrets (required)
JWT_SECRET=your_long_random_64_char_hex_secret
TOKEN_ENCRYPTION_KEY=your_64_char_hex_key_for_aes_256_gcm
```

### Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API & OAuth: http://localhost:3001

Open the app and sign in with Google.

## Testing & Verification

```bash
npm test -w server            # backend unit test suite
npm test -w client            # frontend unit/component tests (vitest)
npm run build -w client       # TypeScript check + production build
npm run db:inspect -w server  # inspect SQLite tables, row counts, samples
```

## Documentation

| Doc | Contents |
| :--- | :--- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | HLD + LLD (client & server), database schema, security model, API endpoints, data flows |
| [FEATURES.md](FEATURES.md) | Feature guides, safety model, release status, roadmap |
| [DESIGN.md](DESIGN.md) | Design system: themes, semantic tokens, component inventory, UI rules |
| [CLAUDE.md](CLAUDE.md) | AI/developer context: commands, project layout, core patterns, gotchas |

## License

MIT License. © 2026 EmailDiet.
