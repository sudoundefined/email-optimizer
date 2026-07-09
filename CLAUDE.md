# Email Unsubscriber — Architecture & Features

## Overview

Email Unsubscriber is a full-stack web application that connects to a user's Gmail account via OAuth 2.0 and provides tools to manage subscriptions, reclaim storage, organize emails with labels, and protect important senders from accidental unsubscription.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite, Material UI v9, Emotion |
| **Backend** | Node.js + Express (ESM), Google APIs (googleapis) |
| **Auth** | Google OAuth 2.0 with PKCE state + CSRF protection |
| **Data** | File-based JSON persistence (tokens, labels, protected senders) |
| **Testing** | Node.js built-in test runner (`node --test`) |
| **Monorepo** | npm workspaces (`client/` + `server/`) |
| **Dev** | Concurrently (parallel Vite dev server + Express API) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT (Vite + React)               │
│                                                             │
│  ConnectScreen ─→ App (Tab Router) ─┬→ SendersTab           │
│                                     ├→ InboxTab             │
│                                     ├→ StorageTab           │
│                                     ├→ ProtectedTab         │
│                                     └→ LabelManager         │
│                                                             │
│  Shared: ScanControls, SenderTable, FilterToolbar,          │
│          ConfirmDialog, UnsubscribePanel, AccountBadge       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (JSON REST)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER (Express API)                     │
│                                                             │
│  index.js ─→ Route Handlers ─→ Service Layer ─→ Gmail API   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   ROUTES (9 files)                   │    │
│  │  auth · scan · inbox · storage · labels             │    │
│  │  unsubscribe · protect · messages · jobs            │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                SERVICES (10 files)                   │    │
│  │  scanService      — Scan inbox for subscriptions    │    │
│  │  inboxService     — Inbox group counts & messages   │    │
│  │  storageService   — Storage analysis & drill-down   │    │
│  │  unsubscribeService — Execute unsubscribe actions   │    │
│  │  labelService     — Create/apply Gmail labels       │    │
│  │  protectService   — Auto-protect important senders  │    │
│  │  headerParser     — Parse From/Unsubscribe headers  │    │
│  │  categorizer      — Classify senders by category    │    │
│  │  trashService     — Move messages to trash          │    │
│  │  messageTrashService — Batch message deletion       │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              INFRASTRUCTURE LAYER                    │    │
│  │                                                     │    │
│  │  gmail/client.js      — Authorized Gmail client     │    │
│  │  gmail/messages.js    — Message list & metadata     │    │
│  │  gmail/mime.js        — MIME building (unsub email)  │    │
│  │  gmail/rateLimiter.js — Concurrency + exp backoff   │    │
│  │  auth/oauthClient.js  — OAuth2 flow + token mgmt   │    │
│  │  auth/tokenStore.js   — File-based token storage    │    │
│  │  jobs/jobManager.js   — Async job queue + progress  │    │
│  │  store/scanCache.js   — In-memory scan results      │    │
│  │  store/labelRegistry.js — Persisted label IDs       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │     Gmail API v1      │
               │  (googleapis library) │
               └───────────────────────┘
```

---

## Backend Architecture

### Entry Point
- **`server/src/index.js`** — Express app with JSON body parsing, 9 route groups mounted under `/api`, and centralized error middleware that converts `NotConnectedError` → 401.

### Auth Layer (`server/src/auth/`)

| File | Purpose |
|------|---------|
| `oauthClient.js` | OAuth2 client creation, auth URL generation with CSRF state tokens (10-min TTL), callback token exchange, automatic token refresh, `withAuthErrorHandling` wrapper that converts `invalid_grant` to 401, and revoke/logout |
| `tokenStore.js` | File-based JSON storage for OAuth tokens at `server/data/tokens.json` |

### Gmail Layer (`server/src/gmail/`)

| File | Purpose |
|------|---------|
| `client.js` | Returns an authorized `gmail.users` client |
| `messages.js` | `listAllMessageIds` (paginated listing) and `getMetadata` (parallel metadata fetch with progress callbacks) |
| `mime.js` | `parseMailto` URI parsing, `buildUnsubscribeEmail` raw MIME construction with header-injection sanitization, `base64url` encoding |
| `rateLimiter.js` | Shared concurrency limiter (`p-limit`, 20 concurrent) with exponential backoff (500ms→32s + jitter) on 429/5xx/403-rate-limit errors, up to 5 attempts |

### Services Layer (`server/src/services/`)

| Service | Key Functions | Description |
|---------|--------------|-------------|
| **scanService** | `runScan`, `scanView` | Lists candidate messages (promotions/updates/social/forums or containing "unsubscribe"), fetches metadata, groups by sender, determines best unsubscribe method per sender. Configurable time range (3m/6m/1y/all). Caches results in memory. |
| **inboxService** | `listGroups`, `getGroup` | Reports live counts for 11 inbox groups (Important, Primary, Marketing, Social, Updates, Forums, Starred, Unread, With Attachments, Large >5MB, Stale Unread 6mo+). Label-backed groups use exact counts; query-backed use estimates. |
| **storageService** | `getStorageStats`, `getDrillDownMessages` | Scans all emails >500KB, aggregates by sender (top 10), month (all), year, size band (6 bands from <500KB to >25MB), and large attachments (>5MB). 5-minute in-memory cache. Drill-down returns individual messages filtered by sender/month/year/size. |
| **unsubscribeService** | `runUnsubscribe` | Executes unsubscribe for a sender using the best available method: **one-click POST** (RFC 8058), **mailto** (sends an email via Gmail API), or **browser link** (returns URL). Includes SSRF protection (rejects private IPs, localhost, non-HTTPS). |
| **labelService** | `runApplyLabels`, `removeLabels` | Creates Gmail labels under configurable prefix (`Unsub/`), batch-applies them to scanned messages (1000 per batch), manages label registry. |
| **protectService** | `autoProtectFromScan`, `protectSenders`, `isProtected` | Auto-detects senders from banks, government, utilities, insurance based on domain and subject keyword heuristics. File-persisted protected sender list. Protected senders cannot be unsubscribed. |
| **categorizer** | `categorize` | Classifies senders into categories (Promotions, Newsletters, Social, Shopping, Finance, Travel, Other) using domain matching, Gmail category labels, and subject keywords. Returns confidence scores. |
| **headerParser** | `parseFrom`, `unsubscribeInfo`, `parseListUnsubscribe` | Parses RFC 2047 encoded `From` headers, extracts `List-Unsubscribe` and `List-Unsubscribe-Post` headers, determines best unsubscribe method (one-click > mailto > link > none). |
| **trashService** | `trashMessages` | Moves selected messages to Gmail Trash (recoverable for 30 days). |
| **messageTrashService** | `trashMessagesBatch` | Batch trash with batched Gmail API calls. |

### Job System (`server/src/jobs/`)

| File | Purpose |
|------|---------|
| `jobManager.js` | UUID-based async job manager with EventEmitter-based progress streaming, state tracking (running/done/error), auto-pruning of finished jobs (keeps last 20) |

**Supported Jobs:**
- `scan` — Inbox scan for subscription senders
- `unsubscribe` — Execute unsubscribe action
- `apply-labels` — Batch label application
- `trash` — Batch message trashing

### Data Store (`server/src/store/`)

| File | Purpose |
|------|---------|
| `scanCache.js` | In-memory cache for scan results (lost on server restart) |
| `labelRegistry.js` | File-persisted JSON mapping of created label names → Gmail label IDs |

### Configuration (`server/src/config.js`)

Environment-driven configuration via `.env`:
- Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Redirect URI, client URL, port
- Data directory paths (tokens, label registry, protected senders)
- Scan limits (`scanMaxMessages`: no cap by default; `SCAN_MAX_MESSAGES` env to limit)
- Label prefix (`Unsub/`)

---

## API Routes

| Route Group | Endpoints | Purpose |
|------------|-----------|---------|
| `GET /api/health` | Health check | Returns `{ ok: true }` |
| `/api/auth` | `GET /url`, `GET /callback`, `GET /status`, `POST /logout` | OAuth flow |
| `/api/scan` | `POST /scan`, `GET /scan` | Start scan job, get scan results |
| `/api/inbox` | `GET /inbox/groups`, `GET /inbox/group/:key/messages` | Inbox group counts and messages |
| `/api/storage` | `GET /storage/stats`, `GET /storage/drill`, `POST /storage/refresh` | Storage analysis |
| `/api/labels` | `POST /labels/apply`, `DELETE /labels/:name`, `GET /labels` | Label management |
| `/api/unsubscribe` | `POST /unsubscribe` | Execute unsubscribe |
| `/api/protect` | `GET /protected`, `POST /protect`, `DELETE /protect` | Manage protected senders |
| `/api/messages` | `POST /messages/trash` | Trash messages |
| `/api/jobs` | `GET /jobs/:id` | Poll job status |

---

## Frontend Architecture

### Component Tree

```
App.tsx (Tab navigation + auth state)
├── ConnectScreen.tsx      — OAuth login card
├── AccountBadge.tsx       — Connected account indicator
├── ScanControls.tsx       — Scan launcher + stats display
├── SendersTab.tsx         — Subscription sender management
│   ├── FilterToolbar.tsx  — Category/method/search filters
│   ├── SenderTable.tsx    — Sortable sender table with bulk actions
│   ├── UnsubscribePanel.tsx — Unsubscribe action executor
│   └── LabelReview.tsx    — Label assignment review
├── InboxTab.tsx           — Inbox group browser with message lists
├── StorageTab.tsx         — Left/right pane storage analyzer
│   └── DrillPanel         — Inline detail table for filtered messages
├── ProtectedTab.tsx       — Protected sender management
└── LabelManager.tsx       — Manage created Unsub/* labels
```

### Key Frontend Modules

| File | Purpose |
|------|---------|
| `api.ts` | Typed HTTP client with `ApiError` class, methods for all API endpoints |
| `theme.ts` | MUI theme with custom color palette, typography, component overrides, CSS keyframe animations |
| `types.ts` | TypeScript interfaces for all API response shapes |
| `hooks/useJob.ts` | Custom hook for polling async job progress |

---

## Features Summary

### 1. 📧 Subscription Scanner
- Scans inbox for subscription/promotional emails across configurable time ranges
- Groups by sender, detects best unsubscribe method per sender
- Categorizes senders (Promotions, Newsletters, Social, Shopping, Finance, Travel)
- Scans the full matching set (no message cap by default; `SCAN_MAX_MESSAGES` env to limit)
- Time ranges: last month, 3 months, 6 months, 1 year, all time

### 2. 🚫 Smart Unsubscribe
- **One-Click POST** (RFC 8058) — Fully automated, server-side
- **Mailto** — Sends unsubscribe email via Gmail API
- **Browser Link** — Opens unsubscribe page in browser
- SSRF protection against private/loopback addresses

### 3. 🛡️ Sender Protection
- Auto-detects banks, government, utilities, insurance (30+ protected domains)
- Subject keyword heuristics (statements, invoices, tax documents, etc.)
- Manual protect/unprotect with file-persisted list
- Protected senders are blocked from unsubscribe actions

### 4. 📊 Inbox Analytics
- Live counts for 11 inbox categories (Important, Primary, Marketing, Social, etc.)
- Query-based groups: Attachments, Large emails, Stale unread
- Drill-down into individual messages per group

### 5. 💾 Storage Analyzer
- Scans all emails >500KB with aggregation by sender, month, year, and size band
- Left/right master-detail pane layout
- Dependent date filtering (Year → Month drill-down)
- Large attachment table (>5MB) with bulk select
- Bulk trash with confirmation dialog (30-day Gmail recovery)
- 5-minute server-side cache for performance

### 6. 🏷️ Label Management
- Creates Gmail labels under `Unsub/*` prefix
- Batch-applies labels to scanned sender messages (1,000 per batch)
- Label registry persisted to JSON for cross-session tracking
- Remove labels from Gmail or trash emails and delete label

### 7. 🔐 Security
- OAuth 2.0 with CSRF state tokens (10-minute TTL)
- Automatic token refresh with `invalid_grant` detection
- SSRF mitigation on unsubscribe URLs (DNS resolution, private IP blocking)
- Header injection sanitization in MIME email construction
- Scoped Gmail permissions (`gmail.modify` + `gmail.send`)

### 8. ⚡ Performance & Reliability
- Gmail API rate limiter with 20 concurrent connections
- Exponential backoff (500ms → 32s + jitter) on 429/5xx errors
- Async job queue with progress streaming for long-running operations
- In-memory caching for scan results and storage stats

---

## Test Coverage

7 test suites with 55 tests covering:

| Suite | Tests | Coverage Area |
|-------|-------|--------------|
| `categorizer.test.js` | 7 | Domain matching, subject keywords, Gmail category fallback |
| `headerParser.test.js` | 14 | From parsing (RFC 2047), List-Unsubscribe extraction, one-click detection |
| `inboxService.test.js` | 4 | Group key uniqueness, label/query validation |
| `mime.test.js` | 4 | Mailto parsing, MIME building, header injection prevention, base64url |
| `protectService.test.js` | 7 | Domain/subject heuristics, auto-protect, protect/unprotect round-trip |
| `rateLimiter.test.js` | 6 | Retry logic, 429/5xx handling, non-retryable errors |
| `storageService.test.js` | 9 | Aggregation functions, size bands, byte conversion |

---

## Data Flow

```
User clicks "Scan" → POST /api/scan
  → jobManager.createJob('scan', scanService.runScan)
    → gmail.messages.list (paginated, rate-limited)
    → gmail.messages.get (parallel, rate-limited)
    → Group by sender, detect unsubscribe methods
    → Cache in scanCache
  → Client polls GET /api/jobs/:id until done
  → Client fetches GET /api/scan for results

User clicks "Unsubscribe" → POST /api/unsubscribe
  → Verify sender is not protected
  → Execute method: one-click POST / mailto / return link
  → Return result to client

User views "Storage" → GET /api/storage/stats
  → Fetch all emails >500KB (paginated)
  → Aggregate by sender, month, year, size band
  → Cache for 5 minutes
  → Client renders left/right pane layout

User clicks month → GET /api/storage/drill?by=month&value=2025-06
  → Filter cached messages by month
  → Return sorted message list to right pane
```
