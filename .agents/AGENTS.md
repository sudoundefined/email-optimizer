# EmailDiet — Agent Coding Guidelines & Context

This document contains rules, invariants, layout maps, and guidelines that **must** be followed by any AI agent or developer working on the EmailDiet project.

---

## 🛡️ Invariants & Safety Rails (NEVER VIOLATE)

1. **Gmail as the Source of Truth:** Never store email bodies or messages locally. Read metadata headers (`From`, `Subject`, `Date`, `List-Unsubscribe`, `List-Unsubscribe-Post`) on the fly, and use in-memory caches (like `scanCache.js`) for the session.
2. **Safe Deletion Default:** All cleanup routes (trash senders, trash messages, keep-latest, filter-trash) must move emails to the Gmail `TRASH` label only. Never call permanent deletion APIs, except for the explicit user-triggered **Empty Trash** path (`messages.batchDelete` scoped strictly to `in:trash`).
3. **Multi-User Tenant Isolation:** Every SQLite/Postgres row and backend service call must be strictly partitioned by `userId`. Pass `userId` as the first parameter to all service functions (`ON DELETE CASCADE`).
4. **Token & Session Security:** OAuth tokens must be stored encrypted at rest using AES-256-GCM (NIST SP 800-38D, 12-byte base64 IVs) in `TokenRepository`. User sessions are HTTP-only `SameSite=Lax` JWT cookies (7-day TTL).
5. **SSRF Protection:** One-click unsubscribe POST calls must be restricted to HTTPS and check resolved IP addresses via DNS pinning (`assertSafeUrl` / `pinnedLookup`) to block private ranges (`10/8`, `172.16/12`, `192.168/16`), loopbacks, link-local (`fe80:`), unique local (`fc00:`), and cloud metadata (`169.254.169.254`).
6. **Deterministic Analytics & Explainability:** All dashboard insights, health scores (0–100), and categorization engines must be 100% deterministic, explainable (providing plain-English `why` strings and structured `action` objects), and zero-AI overhead. Never introduce external AI API calls or non-deterministic heuristics into calculation or scoring engines.

---

## 📚 Documentation Map (Read on Demand)

- `ARCHITECTURE.md` — HLD/LLD, middleware pipeline, services table, API routes, data flows, full schema SQL, file index.
- `FEATURES.md` / `FEATURES_V2.md` — Per-feature usage guides, safety model, calculation engine specs, roadmap.
- `DESIGN.md` — Styling source of truth (themes, tokens, Apple HIG principles, component inventory).
- `API_DOCUMENTATION.md` — Complete endpoint catalogs and cURL request examples.
- `server/openapi.yaml` — OpenAPI 3.0.3 paths and component schemas.
- `SECURITY.md` — OWASP Top 10 / VibeSec audit history and defensive verifications.
- `README.md` — Setup, feature matrix, and project orientation.

---

## ⚡ Workspace Skills & Templates (`.agents/`)

When working on complex tasks, leverage our custom workspace skills (`.agents/skills/`) and standardized code templates (`.agents/templates/`):

- **Skills (Registered via `.agents/skills.json`)**:
  - `emaildiet-backend-verifier`: Use when building or modifying backend services/routes to verify `userId` scoping, `TRASH`-only deletion, rate-limiting, and run `npm test -w server`.
  - `emaildiet-5way-doc-sync`: Use whenever an endpoint, service, or schema changes to execute the mandatory 5-way sync (`ARCHITECTURE.md`, `FEATURES_V2.md`, `README.md`, `API_DOCUMENTATION.md`, `server/openapi.yaml`).
  - `emaildiet-ui-apple-hig`: Use when creating or updating React UI components to verify semantic tokens (`bg.card`, `border.glass`), glassmorphism, SF font stack, and Two-Pane layouts.
- **Boilerplate Templates (`.agents/templates/`)**:
  - `service_template.js`: Canonical pattern for `userId`-first domain services (`limited` Gmail calls, SSE progress, audit logging).
  - `controller_template.js`: Canonical pattern for Express controllers (`req.userId`, allowlist input validation, array bounds).
  - `repository_template.js`: Canonical pattern for `postgres.js` repositories (`user_id` scoping, allowed-key updates).

---

## 🛠️ Commands

```bash
npm run dev                  # API :3001 (--watch) + Vite :5173
npm test -w server           # backend unit tests (node --test)
npm test -w client           # frontend unit/component tests (vitest + jsdom)
npm run build -w client      # tsc check + prod build
npm run db:inspect -w server # dump database tables/rows
```

---

## 📂 Layout Tree (Key Paths)

```
client/src/
  App.tsx        # tab router, auth state, color mode
  api.ts         # typed HTTP client (credentials:'include', ApiError)
  types.ts       # all API response interfaces
  components/    # TSX UI components; follow two-pane master-detail and Apple HIG rules
  hooks/         # useJob (SSE+poll), useAuth, useAutoClearAlert
  utils/         # exportExcel.ts (SheetJS), searchQuery.ts (tag-search parse/suggest/filter/compile)
  theme/         # themes.ts (botanical|espresso), ThemeContext.tsx
server/src/
  index.js       # middleware pipeline + route mounting
  config.js      # .env config, OAuth scopes
  auth/          # oauthClient, jwt, authMiddleware (sets req.userId), rateLimitMiddleware
  db/            # db.js (postgres.js/SQLite WAL, 13 tables), crypto.js (AES-256-GCM)
  gmail/         # client, mockClient, messages, mime, rateLimiter (p-limit 20 + backoff)
  services/      # all domain services (ALL take userId first)
  store/         # scanCache (in-memory, lost on restart), labelRegistry, digestStore
  routes/        # express routes mounted under /api
  jobs/          # jobManager (UUID jobs + EventEmitter SSE), scheduler (digest cron)
```

---

## 💻 Backend Coding Rules & Patterns

1. **Service Signatures:** Service functions must accept `userId` first:
   ```js
   export async function myService(userId, options, emit, signal) { ... }
   ```
   Get Gmail client via `getGmail(userId)`. Wrap Gmail-calling services with `withAuthErrorHandling(fn, userId)`.
2. **Route Pattern:** Retrieve `req.userId` from `authMiddleware`; structure handlers with clean error propagation:
   ```js
   try { const data = await service.fn(req.userId, req.body); res.json(data) } catch (err) { next(err) }
   ```
3. **Gmail API Rate Limiting:** Never call the raw `gmail` object directly. Wrap all queries using `limited` from `gmail/rateLimiter.js` (`p-limit(20)`) and helper methods in `gmail/messages.js` to automatically handle `429` / `5xx` exponential backoff.
4. **Long-Running Work → Job System:**
   ```js
   const job = createJob(req.userId, 'name', async (emit, signal) => {
     emit({ phase: 'x', progress: 0 })   // SSE; check signal.aborted
     return result
   })
   res.json({ jobId: job.id })
   ```
5. **SSE Streaming Endpoints:** Server-Sent Event (SSE) streaming connections (`routes/jobs.js`) must use `safeSend()` with checks for `res.destroyed || res.writableEnded` to prevent proxy `ECONNRESET` crashes:
   ```js
   const safeSend = (event, data) => {
     if (res.destroyed || res.writableEnded) return
     try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }
     catch { /* socket dead */ }
   }
   ```
6. **Protect-List & Guardrails:** Check `isProtected(userId, email)` before ANY unsubscribe, trash, keep-latest, or filter-trash operation.
7. **Activity Audit Trail:** Log all key database or Gmail mutations (`scan`, `unsubscribe`, `trash`, `label`, `keep_latest`, `login`, `logout`) in the `activity_log` table via `auditService.logActivity`.
8. **Loop & API Payload Optimization:** Never create redundant JSON object wrappings inside tight inner loops during data normalization or metrics aggregation. Keep data structures flat during processing.
9. **API Response Reduction:** Always enforce query result limits (e.g., `LIST_LIMITS`) and leverage precomputed JSONB summaries (e.g., `ScanCacheRepository.dashboard_json`) to ensure API responses serve within `<10ms`.
10. **Input Allowlist Validation:** Controller methods must validate request inputs and verify string/enum boundaries (`step`, `timeRange`, ID arrays) before passing them downstream to services or repositories.

---

## 🎨 UI & Design Rules (DESIGN.md)

1. **Semantic Tokens Only:** Always use semantic tokens (`bg.app`, `bg.card`, `bg.glass`, `text.primary`, `text.secondary`, `border.glass`, `brand.icon`, etc.). **Never** hardcode hex colors or use standard colors.
2. **Single Accent:** Use `brand.500` for primary accents, hover highlights, and selections. Do not use per-tab accent colors.
3. **Apple HIG Aesthetics:**
   - Cards/dialogs: `3xl` border-radius (`14px` / `18px`), `bg.card` background, `border.glass` border, and `backdrop-filter: blur(12px)`.
   - Fonts: Native SF system stack (no Google or web font imports).
   - Separators: Hairline thin dividers (`rgba(60, 60, 67, 0.18)`), never thick black borders.
   - Corners: Controls `xl`, badges `lg`, no sharp square edges.
4. **Layout Pattern:** Senders and Storage views must follow a **Two-Pane Master-Detail** layout (left filter panel: `GridItem md=4 lg=3`, right tables/detail: `GridItem md=8 lg=9`). Tables: Sentence Case headers, `brand.50` header bg, 3px inset left-edge highlight on selection.
5. **Non-Blocking UX:** Always use loaders (`EmailLoader`, circular progress) for background tasks, and keep table selections highlighted without background color shifts.
6. **Destructive Actions:** Require `ConfirmDialog` (arming delay + typed confirm for large sets >500 emails).

---

## ⚙️ Schema & Environment Overview

- **Database Layer**: 13 tables (`users`, `tokens`, `preferences`, `protected_senders`, `label_registry`, `activity_log`, `digest_baseline`, `scan_cache`, `sender_cache`, `cleanup_history`, `weekly_digest`, `saved_views`, `scan_metadata`). All rows are strictly scoped to `users(id)` (`ON DELETE CASCADE`).
- **Environment**: Required `.env` keys in `server/`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `JWT_SECRET`. Optional/Defaults: `PORT=3001`, `HOST=127.0.0.1`, `CLIENT_URL=http://localhost:5173`, `DEMO_MODE=false`.

---

## ⚠️ Operational Gotchas

1. **Vite Proxy Target:** Must be `127.0.0.1:3001` (not `localhost` due to IPv6 resolution on Windows). SSE through proxy requires `safeSend()` guards.
2. **OAuth Testing Mode:** Tokens expire in ~7 days. The digest scheduler pauses automatically until re-auth occurs (fails safe, sends nothing).
3. **Scan Cache & Demo Isolation:** In-memory scan caches (`scanCache.js`) and mock Gmail state (`mockStateByAccount`) are per-user and reset on server restart.
4. **Batch Limits:** Trashing >500 emails requires typed count confirmation; `filter-trash` and `keep-latest` cap at 10,000 messages/run; custom query labeling caps at 5,000.

---

## 🚀 New Feature Checklist & Development Protocol

Before finalizing any task, ensure that:

1. **Backend-First Phasing:** When building multi-part features (onboarding, calculation engines, new views), always implement and verify the backend data model, services, controllers, routes, and unit tests (`npm test -w server`) first. Add frontend UI work to the TODO list to be executed only after the backend foundation is verified.
2. **Implementation Pipeline:** service (`userId` first) → route (`req.userId`, `next(err)`) → mount in `index.js` → `createJob` if long-running → `*.test.js` (`node --test`) verification → `api.ts` method → `types.ts` interface → component (`DESIGN.md` rules) → `*.test.ts(x)` (`vitest` client tests).
3. **Mandatory 5-Way Documentation Sync:** Whenever any service, controller, route, or API schema is added or modified, you MUST update all 5 core documentation files before finishing:
   - `ARCHITECTURE.md` (HLD/LLD, File Index, Service/Route Tables, and Test Coverage suite count)
   - `FEATURES.md` / `FEATURES_V2.md` (Detailed feature behavior and safety models)
   - `README.md` (Features summary table and documentation index)
   - `API_DOCUMENTATION.md` (Endpoint catalogs and cURL request examples)
   - `server/openapi.yaml` (OpenAPI 3.0.3 paths and component definitions)
4. **Final Suite Verification:** Verify clean compilation and zero test failures:
   ```bash
   npm test -w server
   npm run build -w client
   ```
