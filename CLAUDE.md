# EmailDiet — AI Context (keep this file lean; details live in linked docs)

Multi-user SaaS Gmail optimizer. Google OAuth → scan inbox metadata → bulk unsubscribe / trash / label / protect / keep-latest-N / Excel export. React 18 + Express + SQLite monorepo (npm workspaces: `client/`, `server/`).

**Invariants (never violate):**
- Gmail is source of truth; never store email bodies — metadata headers only (`From`, `Subject`, `Date`, `List-Unsubscribe`, `List-Unsubscribe-Post`).
- Trash only, never permanent delete — sole exception: explicit Empty Trash (`batchDelete`, scoped `in:trash`).
- OAuth tokens AES-256-GCM encrypted at rest; sessions are HTTP-only `SameSite=Lax` JWT cookies (7d).
- Every DB row and service call is scoped by `userId` (tenant isolation, `ON DELETE CASCADE`).

**Doc map (read on demand, not upfront):**
- `ARCHITECTURE.md` — HLD/LLD, middleware pipeline, services table, API routes, data flows, full schema SQL, file index
- `FEATURES.md` — per-feature usage guides, safety model, roadmap
- `DESIGN.md` — styling source of truth (themes, tokens, component inventory)
- `README.md` — setup/env

## Commands

```bash
npm run dev                  # API :3001 (--watch) + Vite :5173
npm test -w server           # backend unit tests (node --test)
npm run build -w client      # tsc check + prod build
npm run db:inspect -w server # dump SQLite tables/rows
```

## Layout (only non-obvious paths)

```
client/src/
  App.tsx        # tab router, auth state, color mode
  api.ts         # typed HTTP client (credentials:'include', ApiError)
  types.ts       # all API response interfaces
  components/    # 19 TSX; largest: MailboxTab (45KB), StorageTab (37KB), LabelManager (36KB) — read sections, not whole files
  hooks/         # useJob (SSE+poll), useAuth, useAutoClearAlert
  utils/exportExcel.ts  # SheetJS export
  theme/         # themes.ts (botanical|espresso), ThemeContext.tsx
server/src/
  index.js       # middleware pipeline + route mounting
  config.js      # .env config, OAuth scopes
  auth/          # oauthClient, jwt, authMiddleware (sets req.userId), rateLimitMiddleware
  db/            # db.js (SQLite WAL, 7 tables), crypto.js (AES-256-GCM)
  gmail/         # client, messages, mime, rateLimiter (p-limit 20 + backoff) — never call Gmail API directly
  services/      # 15 files, ALL take userId first
  store/         # scanCache (in-memory, lost on restart), labelRegistry, digestStore (SQLite)
  routes/        # 12 route files
  jobs/          # jobManager (UUID jobs + EventEmitter SSE), scheduler (digest cron)
```

## Patterns (mandatory)

1. **Service:** `export async function feature(userId, opts, emit, signal)` — `userId` first, always. Get Gmail via `getGmail(userId)`. Wrap Gmail-calling services with `withAuthErrorHandling(fn, userId)` (expired token → 401 → client shows disconnect).
2. **Route:** `req.userId` from authMiddleware; `try { ... res.json(r) } catch (err) { next(err) }`.
3. **Long-running work → job system:**
   ```js
   const job = createJob(req.userId, 'name', async (emit, signal) => {
     emit({ phase: 'x', progress: 0 })   // SSE; check signal.aborted
     return result
   })
   res.json({ jobId: job.id })
   ```
   Client: `useJob()` → SSE `/api/jobs/:id/events` → 2s poll fallback.
4. **SSE writes:** always guard `if (res.destroyed || res.writableEnded) return` + try/catch (see `routes/jobs.js safeSend`).
5. **Protect-list:** check `isProtected(userId, email)` before ANY unsubscribe/trash/keep-latest/filter-trash; count exclusions.
6. **Gmail calls:** only via `gmail/messages.js` wrappers (rate limiter handles 429/5xx backoff).
7. **Client HTTP:** add method to `api.ts`; response interface to `types.ts`.
8. **Injection defense:** validate sender emails before Gmail queries; filter-trash accepts allow-listed keys only, never raw queries; escape sender content in digest HTML; sanitize mailto MIME headers.

## Schema (7 tables, all FK→users(id) CASCADE; full SQL in ARCHITECTURE.md §10)

users(id=Google sub, email, display_name, avatar_url) · tokens(user_id, encrypted, iv) · preferences(default_time_range='3m', scan_max_messages, label_prefix='Unsub/', digest_*) · protected_senders(email, domain, source auto|manual, UNIQUE(user_id,email)) · label_registry(label_name→gmail_id) · activity_log(action, details JSON) · digest_baseline(senders JSON, last_run_at)

## Env (.env in server/)

Required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`. Strongly recommended: `JWT_SECRET` (else sessions die on restart). Defaults: `PORT=3001`, `HOST=127.0.0.1`, `CLIENT_URL=http://localhost:5173`, `SCAN_MAX_MESSAGES=Infinity`, `RATE_LIMIT_PER_MINUTE=60`. Scopes: `gmail.modify`, `gmail.send`, `userinfo.profile`, `userinfo.email`.

## UI rules (full rulebook: DESIGN.md — it supersedes anything else)

- Two themes (**Botanical Forest** default, **Espresso**) × light/dark = 4 renderings; verify all four. Theme via `useAppTheme()` (localStorage `app-theme`); mode via Chakra `useColorMode()` (no OS sync).
- **Semantic tokens only** (`bg.*`, `text.*`, `border.*`, `brand.*`) — never hard-code hex. Single accent `brand.500` per theme. NOT the Apple system palette.
- Pill buttons/tabs/tags (weight 600); cards/modals `3xl` + `bg.card` + `border.glass` + blur(12px); inputs `xl`; no sharp corners; neutral shadows only; SF system font stack (no web fonts).
- Two-pane master-detail for data tabs: left `md=4 lg=3`, right `md=8 lg=9`. Tables: Sentence Case headers, `brand.50` header bg, 3px inset left-edge highlight on selection.
- Destructive actions → `ConfirmDialog` (arming delay + typed confirm for large sets). Async ops → `EmailLoader`/`ScanLoader`/`AnimatedProgress`, never block UI.
- Reuse component inventory (DESIGN.md §5) before writing new UI.

## Gotchas

1. Vite proxy target must be `127.0.0.1:3001` (not `localhost` — IPv6 on Windows); SSE through the proxy needs the `safeSend()` guards.
2. OAuth Testing mode: tokens expire ~7 days → digest scheduler pauses until re-auth (fails safe, sends nothing).
3. Scan cache is in-memory per user — lost on server restart; re-scan required.
4. Trashing >500 emails requires typed count confirmation; keep-latest min N=1; filter-trash and keep-latest cap at 10k msgs/run; custom query labeling caps at 5k.
5. Digest first run only seeds baseline (sends nothing); single-job guard prevents scheduler/manual double-fire.

## New feature checklist

service (`userId` first) → route (`req.userId`, `next(err)`) → mount in `index.js` → `createJob` if long-running → `api.ts` method → `types.ts` interface → component (DESIGN.md rules) → `*.test.js` (node:test) → update FEATURES.md + ARCHITECTURE.md → `npm test -w server` + `npm run build -w client`
