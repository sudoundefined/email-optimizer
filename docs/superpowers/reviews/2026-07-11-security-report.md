# Security Review — email-unsubscriber

- **Date:** 2026-07-11
- **Branch reviewed:** `feature/tag-search` (tag-search delta `ef203c6..c262f12`)
- **Reviewer:** Defensive security review (authorized, read-only static analysis)
- **App:** Self-hosted single-user Gmail inbox-management tool. Node/Express server (`server/`) using Google OAuth + Gmail API; React 18 + TS client (`client/`).

---

## Executive summary

The application is in good security shape for its threat model (a single user self-hosting a tool that operates only on their own Gmail account). The recent security-hardening pass (`ef203c6`) meaningfully improved the SSRF defense on the unsubscribe path and formalized CSRF/origin checks. Tokens are encrypted at rest with AES-256-GCM, sessions use httpOnly JWT cookies, all Gmail operations are scoped to `userId: 'me'` (per-account by construction), and the destructive bulk-trash path is correctly gated to an allow-list of server-defined filter keys — free-form queries never reach a delete/trash endpoint.

No Critical or High severity issues were found. The findings are one Medium (defense-in-depth gap in the SSRF guard: TOCTOU / DNS-rebinding between the safety check and the fetch), and a handful of Low/Informational items (auto-generated secrets that silently weaken security if env is misconfigured, no CSP/helmet, permanent `emptyTrash` reachable, residual Gmail-query breadth). The new tag-search feature is well-designed from a security standpoint: query sanitization plus forced quoting of free text, and — most importantly — the server-side invariant that free-form queries are read/label only.

**Finding counts:** Critical 0 · High 0 · Medium 1 · Low 4 · Informational 4

---

## Scope & method

Static analysis and code reading only — no execution, no installs, no network calls. Reviewed:

1. **Tag-search feature end-to-end** — `client/src/utils/searchQuery.ts` → `client/src/api.ts` → `server/src/routes/inbox.js` → `server/src/services/inboxService.js` → Gmail API; plus the no-trash-path invariant and client XSS surface.
2. **Repo-wide surfaces** — OAuth/token/session handling (`server/src/auth/*`, `server/src/index.js`), server hardening (CORS, CSRF, rate limiting, headers, input validation), secrets (working tree + targeted git history), the unsubscribe-execution SSRF surface (`server/src/services/unsubscribeService.js`), and dependency inventory (`npm ls --depth=0`, offline).

Severity is calibrated for a single-user self-hosted tool: e.g. rate-limiting gaps and information leakage are scored Low/Informational because there is no multi-tenant blast radius.

---

## Findings by severity

### Medium

#### M1 — SSRF guard is check-then-use (TOCTOU / DNS-rebinding window) — ✅ REMEDIATED
**File:** `server/src/services/unsubscribeService.js:41-52` (`assertSafeUrl`) and `:54-80` (`oneClickPost`)

> **Remediated (fixed in this branch):** `assertSafeUrl` now returns the validated `{ address, family }` and each hop of `oneClickPost` connects through a pinned `lookup` that can only answer with that checked address, closing the re-resolution window; details in `.superpowers/sdd/m1-fix-report.md`.

**Evidence:** `assertSafeUrl` resolves the hostname with `dns.lookup(host)` and validates the returned address against `isPrivateIp`, then `oneClickPost` issues a *separate* `fetch(currentUrl, …)` call. The name is resolved twice (once for the check, once by `fetch`), so a hostname whose DNS answer changes between the two resolutions — or that returns multiple A records where `dns.lookup` samples a public one but `fetch` connects to a private one — can bypass the guard. `dns.lookup` returns a single address; a rebinding server can answer "public" to the check and "private" (e.g. `169.254.169.254`, `127.0.0.1`) to the connect.

**Impact:** A crafted `List-Unsubscribe` header (fully attacker-controlled email content) could, in principle, make the server issue a POST to an internal/link-local address — the classic cloud-metadata / internal-service SSRF. Body is fixed (`List-Unsubscribe=One-Click`) and the response body is discarded (`res.body?.cancel()`), so this is blind SSRF (no data exfil via response), which limits severity. The redirect loop re-runs `assertSafeUrl` on each hop (`:57`), which is the correct hardening for redirect-based bypass, but does not close the DNS window.

**Exploit scenario:** Attacker sends the victim an email with `List-Unsubscribe: <https://rebind.attacker.test/x>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Victim clicks "unsubscribe" on that sender. `rebind.attacker.test` resolves to a public IP during `assertSafeUrl`, then to `169.254.169.254` when `fetch` connects, causing a POST to the metadata service.

**Remediation:** Resolve the host once, verify the resolved IP is public, then connect to that IP directly (pin it) rather than re-resolving — e.g. pass a custom `lookup`/agent that reuses the validated address, or resolve and substitute the literal IP while sending `Host:`/SNI for the original name. Also consider validating *all* addresses returned (`dns.lookup(host, { all: true })`) and rejecting if any is private. Given it is blind SSRF on a self-hosted single-user tool, Medium is appropriate; raise to High if the app is ever deployed on a cloud host with a reachable metadata endpoint.

---

### Low

#### L1 — Auto-generated JWT secret masks a misconfiguration
**File:** `server/src/config.js:12-15`

`jwtSecret` falls back to `crypto.randomBytes(64)` when `JWT_SECRET` is unset, warning only to the console. On a self-hosted box this silently "works" (sessions just drop on restart), so an operator may never set a real secret. It is a strong random value, so not directly exploitable — the risk is that the warning is missed and other env vars (`TOKEN_ENCRYPTION_KEY`) are assumed present too. **Remediation:** In production (`NODE_ENV==='production'`) fail hard if `JWT_SECRET` is unset rather than auto-generating.

#### L2 — `TOKEN_ENCRYPTION_KEY` hashed with unsalted SHA-256
**File:** `server/src/db/crypto.js:13-20`

The key string is normalized to 32 bytes via a single unsalted `sha256`. This is fine when the env value is already 64 hex chars of entropy (as the `.env.example` instructs), but if an operator supplies a weak passphrase it is directly brute-forceable and there is no KDF stretching. AES-256-GCM usage itself is correct (random 12-byte IV per encryption `:29`, auth tag verified on decrypt `:63`). **Remediation:** Require ≥32 bytes of entropy, or run the input through `scrypt`/`argon2` with a stored salt.

#### L3 — Permanent-delete path (`emptyTrash` / `batchDelete`) is reachable from the API
**File:** `server/src/routes/messages.js:31-39` → `server/src/services/messageTrashService.js:48-80`

`DELETE /api/messages/trash` calls `emptyTrash`, which uses `gmail.users.messages.batchDelete` — a *permanent, non-recoverable* delete (unlike every other path, which uses TRASH labels recoverable for 30 days). It only empties the Gmail Trash and requires auth+CSRF, so blast radius is limited, but it is the one irreversible operation in the app. **Remediation:** Ensure the client always requires an explicit confirm for this action (it is a genuine "empty trash forever"); consider logging it to the audit trail.

#### L4 — No response size / content-type limit on outbound unsubscribe fetch
**File:** `server/src/services/unsubscribeService.js:58-77`

The one-click POST has a 10s timeout (good) and cancels the response body, but does not cap response size before cancel or restrict to expected content types. A malicious endpoint can tie up the socket for up to the timeout. Minor DoS-of-self only. **Remediation:** Acceptable as-is for a single user; optionally add a max-content-length guard.

---

### Informational

#### I1 — No `helmet` / Content-Security-Policy
**File:** `server/src/index.js:29-34`

A small manual header block sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, and `Referrer-Policy` — good baseline. There is no CSP and no HSTS. The API serves JSON (not HTML) and the SPA is served separately by Vite, so CSP value is limited here, but adding `helmet` on any HTML-serving surface (the legal routes, the OAuth error page) would harden defense-in-depth. Note the OAuth error page at `server/src/routes/auth.js:79-84` correctly HTML-escapes `err.message` via `escapeHtml` (`:10-12`).

#### I2 — Residual Gmail-query breadth in tag-search (by design, low risk)
**File:** `client/src/utils/searchQuery.ts:143-173`

`quoteValue` strips `["(){}]` and free text is force-quoted (`compileGmailQuery` `:166`) so it cannot act as a live operator — this is solid. Residual notes: (a) backslashes and `OR`/`AND` keywords are not stripped, but because free text is wrapped in double quotes they are treated as literal search terms by Gmail, not operators; (b) this is a *client-side* transform and is **not a security boundary** — the server (`inbox.js:36-47`) passes `q` straight to `gmail.users.messages.list`. That is acceptable because the query only ever runs against the caller's *own* mailbox (`userId: 'me'`) and only on read/label endpoints. A user can at most craft a broad read query over their own mail — not a security issue. Confirmed no server-side concatenation adds cross-account scope like `in:anywhere`.

#### I3 — Error messages returned to client include raw `err.message`
**File:** `server/src/index.js:87-94`

The global error handler returns `err.message` in the JSON body for any status. For a single-user tool this is a usability win and low risk; in a multi-tenant deployment it could leak internal detail. 5xx errors are logged server-side and not over-shared.

#### I4 — Dependency inventory (offline; `npm audit` not run — no network)
`server/`: `express@4.22.2`, `googleapis@144.0.0`, `jsonwebtoken@9.0.3`, `better-sqlite3@12.11.1`, `cookie-parser@1.4.7`, `cors@2.8.6`, `express-rate-limit@8.5.2`, `dotenv@16.6.1`, `p-limit@6.2.0`.
`client/`: `react@18.3.1`, `vite@6.4.3`, `@chakra-ui/react@2.8.2`, `xlsx@0.18.5`, `framer-motion@10.18.0`, `vitest@4.1.10`, `jsdom@29.1.1`.
No obviously abandoned packages; versions are current-ish. **`xlsx@0.18.5` (SheetJS)** is worth a note: the npm-registry build of `xlsx` has had prototype-pollution / ReDoS advisories historically and SheetJS now ships via their own CDN. It is used only in `client/src/utils/exportExcel.ts` for *writing* exports (not parsing untrusted files), so exposure is minimal. Recommend confirming the version against the latest SheetJS advisory when network is available.

---

## The new tag-search feature (focused assessment)

**Data flow reviewed:** token input → `parseToken`/`compileGmailQuery` (`client/src/utils/searchQuery.ts`) → `api.filterMessages` with `encodeURIComponent` (`client/src/api.ts:99`) → `GET /api/inbox/filter?q=` (`server/src/routes/inbox.js:36`) → `filterMessages` → `gmail.users.messages.list({ userId: 'me', q })` (`inboxService.js:130-148`).

- **Query injection:** Free text is metachar-stripped (`["(){}]`) and force-quoted so it cannot introduce live Gmail operators (`searchQuery.ts:143-147, 166`). Structured chips (`tag/from/subject/is/older_than/newer_than/larger`) are validated against strict patterns in `parseToken` (`:25-64`) before compilation. Residual breadth is read-only and same-mailbox — see **I2**. **No scope-widening possible:** Gmail API is per-account (`userId: 'me'`), and there is no server-side string concatenation that could add `in:anywhere` or another account.
- **No-trash-path invariant — verified server-side (the real boundary):**
  - `POST /api/inbox/filter/:key/trash` rejects anything not in `FILTERS` (`inbox.js:49-61`), and `trashByFilterKey` re-checks the key against the server-defined allow-list (`inboxService.js:184-190`). The query text for trashing comes *only* from `FILTER_DEFS` (`:156-170`) — **never** from user input.
  - The only endpoints that accept a raw `q`/`query` are read (`/api/inbox/filter`) and label (`/api/labels/apply-filter`, `labels.js:40-57`, capped at 2000 chars → `runApplyLabelToFilter` which adds a label, non-destructive). Confirmed: no destructive operation consumes a free-form query.
  - Bulk trash additionally re-checks the protect-list before trashing (`inboxService.js:205-221`) — a strong defense-in-depth guarantee.
- **XSS:** Attacker-controlled email content (subjects, sender names) is rendered exclusively through React text interpolation — e.g. `{m.subject || '(no subject)'}` and `label={m.from}` in `MailboxTab.tsx:141,149`, and `{r.sender}`/`{r.detail}` in `UnsubscribePanel.tsx`. **Zero `dangerouslySetInnerHTML`** anywhere in `client/src`. The one place an email-derived URL becomes an `href` (`UnsubscribePanel.tsx:20-24`) is guarded by an `^https?://` regex and uses `rel="noopener noreferrer"`. Server-side HTML (digest email) escapes all interpolated values via `escapeHtml` (`digestService.js:52-86`). Clean.

---

## Positive observations

- **Token storage:** AES-256-GCM with per-record random IV and verified auth tag (`db/crypto.js`). Tokens never leave the server; decryption failure degrades to "sign in again" (`oauthClient.js:117-122`).
- **OAuth state/CSRF:** `state` is random, stored server-side with a 10-min TTL *and* mirrored in an httpOnly cookie, and both are checked on callback (`oauthClient.js:54-58`, `auth.js:56-64`). Logout revokes the Google credential and deletes the token row (`oauthClient.js:165-183`).
- **Session cookies:** httpOnly, `sameSite: 'lax'`, `secure` in production (`auth.js:67-73`). JWT pinned to `HS256` on both sign and verify (`jwt.js:13,23`) — no `alg:none`/algorithm-confusion exposure.
- **CSRF defense on mutations:** Origin/Referer allow-list check for all state-changing methods (`index.js:53-71`), layered on top of SameSite cookies.
- **Per-user isolation:** Every Gmail call uses `userId: 'me'`; jobs and scan caches are keyed by `userId`, and `getJob`/`cancelJob` enforce `job.userId === userId` (`jobManager.js:65-79`) — no cross-user job access via guessable IDs.
- **Loopback bind by default** (`config.js:19-21`) keeps the API off the LAN unless deliberately exposed.
- **Destructive-by-default avoidance:** All bulk operations use recoverable TRASH labeling, protect-list exclusion is enforced server-side, and message-trash input is size-capped (`messages.js:14`).
- **Header-injection defense** in the outbound unsubscribe email (`mime.js:7-9` strips CR/LF from header values).
- **Input validation** present on the higher-risk routes: `labels/apply-filter` (length caps), `protect` (array + type + count caps), `storage/messages` (enum whitelist), digest recipient (email regex, `digestStore.js:82-85`).
- **Secrets hygiene:** No credentials in the working tree; `.gitignore` excludes `server/.env` and `server/data/`; targeted git-history search (`git log -S`, `git log --diff-filter=A`) found only placeholder values in `.env.example`/`README.md`. History is clean.

---

## Prioritized remediation list

1. **M1 — Close the SSRF DNS-rebinding window** in `unsubscribeService.js`: resolve the host once, reject if any resolved address is private (`dns.lookup(host,{all:true})`), and connect to the pinned/validated IP instead of re-resolving. (Medium; raise to High if ever cloud-hosted.)
2. **L1 — Fail hard on missing `JWT_SECRET` in production** rather than auto-generating (`config.js`).
3. **L2 — Strengthen `TOKEN_ENCRYPTION_KEY` derivation** (enforce entropy or use a salted KDF) (`db/crypto.js`).
4. **L3 — Guard/audit-log the permanent `emptyTrash`** path; ensure the client requires explicit confirmation (`messages.js`, `messageTrashService.js`).
5. **I4 — Re-check `xlsx@0.18.5`** against current SheetJS advisories and run `npm audit` when network is available.
6. **I1 — Add `helmet`/CSP** on HTML-serving surfaces for defense-in-depth (`index.js`).

**Overall risk posture:** Low — a well-constructed single-user self-hosted tool with sound token encryption, session handling, per-account scoping, and a correctly server-enforced no-destructive-free-query invariant; the only non-trivial issue is a defense-in-depth DNS-rebinding window in the blind-SSRF unsubscribe path.
