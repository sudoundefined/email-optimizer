# EmailDiet — AI Context Guide

> For full architecture, schema, and design system details see [ARCHITECTURE.md](ARCHITECTURE.md).
> For feature documentation and roadmap see [FEATURES.md](FEATURES.md).

## What This App Does

EmailDiet is a **multi-user SaaS** Gmail optimizer. Users connect via Google OAuth, scan their inbox for subscription/promotional emails, and take bulk actions: unsubscribe, trash, label, protect, keep-latest-N, and export to Excel. Built with React + Express + SQLite.

**Core principle:** Gmail is the source of truth. The app only reads metadata (never email bodies), only trashes (never permanently deletes), and encrypts OAuth tokens at rest with AES-256-GCM.

---

## Quick Commands

```bash
npm run dev                 # Full stack: API (--watch :3001) + Vite (:5173)
npm test -w server          # Backend unit tests (55 tests, 7 suites)
npm run build -w client     # TypeScript check + Vite production build
npm run db:inspect -w server # Inspect SQLite tables and row counts
```

---

## Project Structure

```
email-unsubscriber/          # npm workspaces monorepo
├── client/                  # React 18 + TypeScript + Vite + Chakra UI v2
│   └── src/
│       ├── App.tsx          # Tab router, auth state, theme
│       ├── api.ts           # Typed HTTP client (credentials: 'include')
│       ├── types.ts         # All TypeScript interfaces
│       ├── components/      # 19 TSX components (MailboxTab is 45KB, largest)
│       ├── hooks/           # useJob (SSE+poll), useAuth, useAutoClearAlert
│       ├── utils/           # exportExcel.ts (SheetJS xlsx generation)
│       └── theme/           # themes.ts (Botanical + Espresso), ThemeContext.tsx
└── server/                  # Node.js + Express (ESM modules)
    └── src/
        ├── index.js         # Express app, middleware pipeline, route mounting
        ├── config.js        # Env-driven config (.env), OAuth scopes
        ├── auth/            # oauthClient, jwt, authMiddleware, rateLimitMiddleware
        ├── db/              # db.js (SQLite WAL, 7 tables), crypto.js (AES-256-GCM)
        ├── gmail/           # client, messages, mime, rateLimiter (p-limit 20)
        ├── services/        # 15 service files, ALL scoped by userId
        ├── store/           # scanCache (in-memory), labelRegistry, digestStore (SQLite)
        ├── routes/          # 12 route files (auth, user, scan, inbox, etc.)
        └── jobs/            # jobManager (UUID jobs + EventEmitter SSE), scheduler
```

---

## Critical Patterns — Follow These

### 1. Every service takes `userId` first

Every backend service function is scoped by user. When adding new service functions or routes:

```js
// ✅ Correct
export async function myNewFeature(userId, opts, emit, signal) {
  const gmail = await getGmail(userId)  // per-user OAuth client
  // ...
}

// ❌ Wrong — no userId scoping
export async function myNewFeature(opts) { ... }
```

### 2. Routes use `req.userId` from auth middleware

All protected routes have `req.userId` set by `authMiddleware.js`. Pass it to every service call:

```js
router.post('/my-endpoint', async (req, res, next) => {
  try {
    const result = await myService.doSomething(req.userId, req.body)
    res.json(result)
  } catch (err) { next(err) }
})
```

### 3. Long-running operations use the Job System

Scan, unsubscribe, trash, label, keep-latest, and digest all run as async jobs:

```js
import { createJob } from '../jobs/jobManager.js'

const job = createJob(req.userId, 'my-job', async (emit, signal) => {
  emit({ phase: 'starting', progress: 0 })  // SSE to client
  // do work, check signal.aborted for cancellation
  emit({ phase: 'processing', progress: 50 })
  return { result: 'done' }  // stored in job.result
})
res.json({ jobId: job.id })
```

Client side uses `useJob()` hook → opens SSE stream → falls back to 2s polling.

### 4. SSE endpoint must guard against destroyed sockets

The `/api/jobs/:id/events` SSE endpoint uses `safeSend()` with `res.destroyed || res.writableEnded` checks. Always follow this pattern for any SSE endpoint:

```js
const safeSend = (event, data) => {
  if (res.destroyed || res.writableEnded) return
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }
  catch { /* client gone */ }
}
```

### 5. Protected senders are enforced everywhere

Before any unsubscribe, trash, keep-latest, or filter-trash action, check `isProtected()`:

```js
const { isProtected } = await import('./protectService.js')
if (await isProtected(userId, senderEmail)) {
  // skip this sender, increment excluded count
}
```

### 6. Gmail API uses rate limiting with backoff

All Gmail API calls go through `rateLimiter.js` (`p-limit(20)` + exponential backoff on 429/5xx). Never call Gmail API directly — use the wrappers in `gmail/messages.js`.

### 7. Client-side API calls use `api.ts`

All frontend HTTP calls go through the typed `api` object in `api.ts`. Add new endpoints there:

```ts
// In api.ts
async myNewEndpoint(data: MyType): Promise<ResultType> {
  const res = await fetch('/api/my-endpoint', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await ApiError.from(res)
  return res.json()
}
```

### 8. TypeScript types mirror API responses

Define interfaces in `types.ts` for every API response shape. Components import from there.

---

## Database Schema (7 tables)

All tables use `ON DELETE CASCADE` foreign keys to `users(id)`.

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `users` | `id` (Google sub), `email`, `display_name`, `avatar_url` | User identity |
| `tokens` | `user_id`, `encrypted`, `iv` | AES-256-GCM encrypted OAuth tokens |
| `preferences` | `user_id`, `default_time_range`, `scan_max_messages`, `label_prefix`, `digest_*` | Per-user settings |
| `protected_senders` | `user_id`, `email`, `domain`, `source` | Protected sender whitelist |
| `label_registry` | `user_id`, `label_name`, `gmail_id` | Gmail label ID mapping |
| `activity_log` | `user_id`, `action`, `details` (JSON), `created_at` | Audit trail |
| `digest_baseline` | `user_id`, `senders` (JSON array), `last_run_at` | Weekly digest state |

---

## Key Configuration (.env)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GOOGLE_CLIENT_ID` | ✓ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✓ | — | Google OAuth client secret |
| `TOKEN_ENCRYPTION_KEY` | ✓ | — | AES-256 key for token encryption |
| `JWT_SECRET` | Recommended | Auto-generated | Sessions don't survive restart without this |
| `PORT` | — | `3001` | API port |
| `HOST` | — | `127.0.0.1` | Bind address (loopback for security) |
| `CLIENT_URL` | — | `http://localhost:5173` | Frontend URL |
| `SCAN_MAX_MESSAGES` | — | `Infinity` | Cap Gmail API usage |
| `RATE_LIMIT_PER_MINUTE` | — | `60` | Per-user rate limit |

---

## UI Design Rules (Apple HIG)

- **Font:** SF system stack (no web-font imports)
- **Colors:** Apple system palette (accent: `#007AFF` systemBlue)
- **Corners:** Cards 14px, dialogs 18px, buttons 10px, chips 8px — **no sharp corners**
- **Shadows:** Restrained neutral shadows only, no colored glows
- **Layout:** Two-pane master-detail for all data tabs (left: filters `md=4 lg=3`, right: tables `md=8 lg=9`)
- **Materials:** Frosted toolbar `rgba(255,255,255,0.72) + backdrop-filter: blur(20px)`, dark action tray `rgba(28,28,30,0.92)`
- **Separators:** Hairline `rgba(60,60,67,0.10–0.18)`, never heavy dividers
- **Tables:** Sentence Case headers, `brand.50` sticky header, inset 3px left-edge highlight on selected rows (no row background shift), standard pagination

---

## Gotchas & Known Issues

1. **Vite proxy + SSE:** The Vite dev server proxies `/api` to `127.0.0.1:3001`. SSE connections through the proxy can cause `ECONNRESET` if the server writes to a destroyed socket — that's why `safeSend()` guards exist in `routes/jobs.js`.

2. **`localhost` vs `127.0.0.1` on Windows:** The server binds to `127.0.0.1` (IPv4 loopback). The Vite proxy target must also use `127.0.0.1`, not `localhost` (which may resolve to `::1` IPv6 first on Windows).

3. **OAuth Testing mode:** Google OAuth in testing mode has a 7-day token expiry. The weekly digest scheduler will pause until the user re-authenticates. Production OAuth verification removes this limit.

4. **Scan cache is in-memory:** Scan results (`scanCache.js`) are lost on server restart. The scan must be re-run after a restart.

5. **Large component files:** `MailboxTab.tsx` (45KB), `StorageTab.tsx` (37KB), and `LabelManager.tsx` (36KB) are the heaviest components. They handle complex state with inline sub-components. Consider reading only the relevant sections.

6. **`withAuthErrorHandling` wrapper:** All service functions that call Gmail API are wrapped with `withAuthErrorHandling(fn, userId)`. This automatically handles expired tokens by returning 401, which the client interprets as a disconnection event.

7. **No email body reads:** The app only fetches metadata headers (`From`, `Subject`, `Date`, `List-Unsubscribe`, `List-Unsubscribe-Post`). Features requiring email body content (expense tracking, AI categorization) are deferred to roadmap.

---

## Adding a New Feature — Checklist

1. **Backend service** → `server/src/services/newService.js` — accept `userId` as first param
2. **Route** → `server/src/routes/newRoute.js` — use `req.userId`, wrap in try/catch with `next(err)`
3. **Mount route** → `server/src/index.js` — add under protected routes section
4. **If long-running** → use `createJob()` in the route, return `{ jobId }`
5. **API client** → `client/src/api.ts` — add typed method
6. **Types** → `client/src/types.ts` — add response interface
7. **UI** → component in `client/src/components/` — follow Apple HIG design rules
8. **Tests** → `server/src/services/newService.test.js` — use `node:test` runner
9. **Docs** → Update `FEATURES.md` (feature guide) and `ARCHITECTURE.md` (technical details)
10. **Verify** → `npm test -w server` + `npm run build -w client`
