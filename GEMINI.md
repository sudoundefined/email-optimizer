# GEMINI.md — AI Agent Memory & Orientation Guide

> **Welcome, AI Coding Assistant!**  
> This file is the primary orientation and memory map for any AI agent (Gemini, Claude, Antigravity, or Copilot) working on the **EmailDiet** codebase. It synthesizes the system architecture, invariants, data flows, operational rules, and development protocols into one high-density reference.
>
> **Canonical Workspace Rules & Memory Locations**:
> - **Programmatic Agent Rules**: **[.agents/AGENTS.md](file:///c:/Users/deepa/email-unsubscriber/.agents/AGENTS.md)** (Loaded automatically by Antigravity IDE)
> - **Living Project State & History**: **[.agents/PROJECT_MEMORY.md](file:///c:/Users/deepa/email-unsubscriber/.agents/PROJECT_MEMORY.md)** (Canonical memory tracking active roadmap and completed milestones)

---

## 🚀 1. Project Identity & Architecture Overview

**EmailDiet** is a multi-user SaaS Gmail optimization platform designed to help users take control of their inbox, identify subscription clutter, reclaim Google storage, and automate mailbox cleaning.

- **Frontend**: React 18 + Vite + TypeScript + Vanilla CSS (using semantic design tokens (`DESIGN.md`) inspired by Apple HIG: glassmorphism, native SF typography, `brand.500` accents).
- **Backend**: Node.js (ESM) + Express + `postgres.js` driver (operating with SQLite local WAL / Postgres compatibility) + Job Manager (SSE streaming with polling fallback) + Dual Gmail API client.
- **Data Model**: Strictly `1:1` User-to-Account architecture where `userId` (Google `sub` OAuth string or UUID) is the primary partition key across all 13 database tables.

---

## 🛡️ 2. Core Invariants & Safety Rails (NEVER VIOLATE)

1. **Gmail as the Source of Truth:** Never store email bodies (`payload.body`) or raw message contents locally. Fetch and parse metadata headers only (`From`, `Subject`, `Date`, `List-Unsubscribe`, `List-Unsubscribe-Post`, `SizeEstimate`) on the fly, and use transient in-memory caches (`scanCache.js`) during active sessions.
2. **Safe Deletion Default:** All cleanup routes (`trashSenders`, `trashMessages`, `keepLatest`, `filterTrash`) MUST move emails to the Gmail `TRASH` label (`{'removeLabelIds': ['INBOX'], 'addLabelIds': ['TRASH']}`). **Never** call permanent deletion APIs, except for the explicit user-triggered **Empty Trash** path (`messages.batchDelete` strictly scoped to `in:trash`).
3. **Multi-User Tenant Isolation:** Every database table (`users`, `tokens`, `preferences`, `protected_senders`, `label_registry`, `activity_log`, `digest_baseline`, `scan_cache`, `sender_cache`, `cleanup_history`, `weekly_digest`, `saved_views`, `scan_metadata`) and service call must be strictly scoped by `userId` (`ON DELETE CASCADE`). Pass `userId` as the very first argument to all service and repository functions.
4. **Token Encryption & Session Security:** OAuth access and refresh tokens are stored encrypted at rest via AES-256-GCM (NIST SP 800-38D) using 12-byte random base64 IVs inside `TokenRepository`. User sessions are HTTP-only `SameSite=Lax` JWT cookies (`token`, 7-day TTL, strictly pinned to `HS256`).
5. **SSRF & CSRF Protection:** One-click unsubscribe `POST` requests (`assertSafeUrl` / `pinnedLookup`) are restricted to `HTTPS` and execute DNS pinning (`dns.lookup` IP verification) to block private network ranges (`10/8`, `172.16/12`, `192.168/16`), loopbacks (`127.0.0.1`, `::1`), link-local (`fe80:`), unique local (`fc00:`), and cloud metadata endpoints (`169.254.169.254`). State mutations enforce CSRF origin/cookie validation (`csrfProtection`).
6. **Deterministic Analytics & Explainability:** All dashboard insights, health scores (`0–100`), and categorization engines are 100% deterministic, explainable (providing plain-English `why` strings and structured `action` objects), and zero-AI overhead. Never introduce external AI API calls or non-deterministic heuristics into calculation engines.

---

## 🔄 3. Dual Gmail Operational Mode (Real vs. Mock/Demo)

To ensure rapid local development, comprehensive testing without network latency, and safe demo presentations without touching real user accounts, EmailDiet operates a **Dual Gmail API Architecture**:

```
Service Call -> getGmail(userId)
                    │
                    ├─► [userId starts with 'acc_demo_' or config.demoMode == true]
                    │       └── routes to: getMockGmailClient(userId) (mockClient.js)
                    │              └── queries isolated in-memory pool (mockStateByAccount)
                    │
                    └─► [Real User Account]
                            └── routes to: google.gmail({ version: 'v1', auth: getAuthedClient(userId) })
                                   └── wrapped by p-limit(20) + exponential backoff (messages.js)
```

- **Mock Isolation:** `mockClient.js` maintains state in `mockStateByAccount = new Map()`. Mutations (`batchModify`, `labels.create`, `batchDelete`) update only the specific account's memory slice.
- **Token Shielding:** When demo mode or demo accounts are queried, `getAuthedClient(userId)` short-circuits and returns `{ access_token: 'mock_demo_token' }` without accessing or decrypting real tokens in `TokenRepository`.

---

## 🧠 4. Domain Service Topology & Key Engines

All domain logic resides in `server/src/services/` and follows the mandatory signature:
```js
export async function myServiceMethod(userId, options, emit = () => {}, signal = null, sql = getDb()) { ... }
```

### Key Service Engines:
- **`onboardingService.js`**: Manages the 7-screen First Login Journey state (`welcome` → `privacy` → `config` → `scanning` → `story` → `celebration` → `completed`). Auto-seeds protected categories (`banking`, `government`, `work`, `family`) using domain and keyword heuristics (`protectService.js` / `categorizer.js`). Calculates the **Mailbox Story** metrics (`totalEmails`, `totalSizeEstimate`, `cleanableMessages`, top senders, storage reclamation potential).
- **`insightsService.js` & Pipeline (`insights/`)**: Orchestrates the 3-stage deterministic calculation engine:
  1. `normalizationEngine.js`: Aggregates flat sender summaries from `SenderCacheRepository`.
  2. `scoringEngine.js`: Calculates the bounded `0–100` Mailbox Health Score and level (`critical`, `needs_attention`, `healthy`, `pristine`) based on unread ratios, clutter volume, and storage weight.
  3. `insightsEngine.js`: Generates structured dashboard widgets (`Priorities`, `Mailbox DNA`, `Achievements`, `Storage Breakdown`) with plain-English `why` strings.
  - **Performance Optimization**: Stores precomputed results inside `ScanCacheRepository.dashboard_json` to guarantee `<10ms` API responses.
- **`storageService.js`**: Aggregates mailbox volume by sender, month/year, and size band (`>20MB`, `10-20MB`, `5-10MB`, `1-5MB`).
- **`unsubscribeService.js`**: Executes `mailto:` and HTTP `POST` (`List-Unsubscribe-Post`) unsubscribes with SSRF/DNS pinning.
- **`labelService.js`**: Manages Gmail label prefixes (`Unsub/`), batch labeling, and custom query tagging (`caps at 5,000`).
- **`protectService.js`**: Manages user allowlists (`ProtectedSenderRepository`) to prevent accidental deletion of important contacts.
- **`jobManager.js`**: Manages asynchronous long-running jobs (scanning, bulk cleanup) via UUIDs, emitting SSE events (`/api/jobs/:id/events`) with `safeSend()` disconnect guards.

---

## ⚙️ 5. Mandatory Development Protocols

### 1. Backend-First Phasing Protocol
When building multi-part features (new calculation engines, onboarding workflows, new views):
1. **First**: Implement and verify the backend data model, repositories, domain services, controllers, express routes, and unit tests (`npm test -w server`).
2. **Second**: Verify all backend verification tests pass cleanly (`161/161 passing across 17 suites`).
3. **Third**: Add frontend UI work to the checklist/TODO list and execute only after the backend foundation is rock-solid.

### 2. Mandatory 5-Way Documentation Sync Protocol
Whenever any service, controller, route, or API schema is added or modified, you **MUST** update all 5 core documentation files before concluding the task:
1. `ARCHITECTURE.md` (HLD/LLD, File Index, Service/Route Tables, and Test Coverage suite count).
2. `FEATURES.md` / `FEATURES_V2.md` (Detailed feature behavior and safety models).
3. `README.md` (Features summary table and documentation index).
4. `API_DOCUMENTATION.md` (Endpoint catalogs and cURL request examples).
5. `server/openapi.yaml` (OpenAPI 3.0.3 paths and component definitions).

### 3. Controller Input Allowlist & Validation
All controllers in `server/src/controllers/` (`userController.js`, `unsubscribeController.js`, `labelController.js`, etc.) MUST strictly validate inputs and enforce allowlist boundaries before passing data downstream:
- Verify exact string enums (`req.body.step` against `ALLOWED_STEPS`, `timeRange` against `['1m', '3m', '6m', '1y', 'all']`).
- Verify array bounds and types (`Array.isArray(req.body.senderEmails)` with `max 2,000` items; `messageIds` with `max 10,000` items).

---

## 🛠️ 6. Quick Command & Verification Cheat Sheet

```bash
# Development Server (API on :3001 with --watch + Vite on :5173)
npm run dev

# Backend Unit Suite (Node native test runner node --test — 17 suites, 161 tests)
npm test -w server

# Frontend Component & Logic Tests (vitest + jsdom)
npm test -w client

# Production Build Check (TypeScript compilation + Vite bundle check)
npm run build -w client

# Database Inspection Utility (Dumps 13 tables and row counts)
npm run db:inspect -w server
```

---

## 📂 7. Layout & Key File Map

```
client/src/
  App.tsx                 # Tab navigation router, authentication state, theme/color mode
  api.ts                  # Typed HTTP client with credentials: 'include' and ApiError handling
  types.ts                # Master TypeScript definitions for API responses and entities
  components/             # UI Components following Apple HIG & Two-Pane Master-Detail patterns
  theme/                  # Semantic design tokens, Botanical & Espresso themes (themes.ts)
server/src/
  index.js                # Express app initialization, middleware pipeline, and route mounting
  config.js               # Environment configurations and Google OAuth scope definitions
  auth/                   # OAuth 2.0 client, JWT handling (`jwt.js`), `authMiddleware`
  db/                     # `db.js` (postgres.js client, 13 tables DDL), `crypto.js` (AES-256-GCM)
  gmail/                  # `client.js`, `mockClient.js`, `messages.js` (rate limiter wrappers)
  services/               # `onboardingService.js`, `insightsService.js`, `insights/` engine
  controllers/            # `userController.js`, `insightsController.js`, etc.
  routes/protected/       # Protected API endpoints (`/user/*`, `/insights/*`, `/jobs/*`)
```

---

## 📚 8. Deep-Dive Documentation Index

When you need granular details on specific subsystems, consult these specialized guides:
- **[.agents/AGENTS.md](file:///c:/Users/deepa/email-unsubscriber/.agents/AGENTS.md)** — The authoritative rulebook loaded into agent context.
- **[ARCHITECTURE.md](file:///c:/Users/deepa/email-unsubscriber/ARCHITECTURE.md)** — High-Level Design, middleware sequence diagrams, full schema SQL definitions, and complete file index.
- **[FEATURES_V2.md](file:///c:/Users/deepa/email-unsubscriber/FEATURES_V2.md)** — Detailed specification of First Login Journey, Mailbox Story, and deterministic dashboard calculation engines.
- **[DESIGN.md](file:///c:/Users/deepa/email-unsubscriber/DESIGN.md)** — Apple HIG design system, semantic tokens, and UI component inventory.
- **[API_DOCUMENTATION.md](file:///c:/Users/deepa/email-unsubscriber/API_DOCUMENTATION.md)** — REST API reference catalogs and cURL request templates.
- **[SECURITY.md](file:///c:/Users/deepa/email-unsubscriber/SECURITY.md)** — OWASP Top 10 and VibeSec audit history and defensive verifications.
- **[server/openapi.yaml](file:///c:/Users/deepa/email-unsubscriber/server/openapi.yaml)** — OpenAPI 3.0.3 machine-readable API specification.
