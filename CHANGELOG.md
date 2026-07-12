# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v2.0.0] - 2026-07-12

### Added
- **Multi-User SaaS Architecture**: Full multi-tenant isolation via SQLite WAL (`users`, `tokens`, `preferences`, `protected_senders`, `label_registry`, `activity_log`, `digest_baseline`) with strict `userId` foreign keys (`ON DELETE CASCADE`) and per-user data isolation across all services and routes.
- **Mailbox UI & Layout Redesign (Phases A–F)**:
  - Fixed collapsible navigation rail and flat merged top navigation bar.
  - Sticky search toolbar with floating search bar and sender summary statistics on the scan line.
  - Applied search filters displayed as removable tag chips outside the input bar.
  - High-density senders table layout with a responsive two-pane master-detail view.
  - Mobile responsive navigation drawer.
  - Toast notification system and unified single progress strip.
- **Excel Export**: Integrated client-side SheetJS (`xlsx`) spreadsheet export for sender lists and storage audit reports.
- **Custom Smart Filter Labeling**: Ability to apply custom Gmail labels to emails matching Smart Filter criteria (capped at 5,000 messages with archive option).
- **Automated Testing Suite**: Full frontend testing suite (`vitest` + `jsdom` + Testing Library) with 48 tests alongside backend Node.js unit tests (125 tests) for a total of 173 passing automated tests.
- **Database & Debugging Tooling**: Added `npm run db:inspect -w server` CLI tool for inspecting SQLite tables and rows.
- **AI Context & Design Documentation**: Added comprehensive AI agent context (`AGENTS.md`) and EmailDiet 2.0 Design Specification (`docs/redesign/EMAILDIET-2.0-DESIGN-SPEC.md`).

### Security
- **OAuth Token Encryption**: AES-256-GCM encryption at rest for Google OAuth tokens using 12-byte base64 IVs.
- **Session & CSRF Hardening**: HTTP-only `SameSite=Lax` JWT cookies (7-day TTL) with state verification against login CSRF.
- **SSRF Defense**: One-click unsubscribe requests pin validated IP addresses at connect time to prevent DNS-rebinding attacks and block private IP ranges, localhost, and loopbacks.
- **Query Injection Defense**: Tag-search queries strip Gmail metacharacters and quote free-text terms.

### Fixed
- **SSE Connection Resilience**: Guarded Server-Sent Events streaming against proxy `ECONNRESET` crashes (`safeSend`).
- **Scan & Job Reliability**: Fixed scan/job hanging issues when backend momentarily blips or reconnects.
- **Tag-Search UI Polish**: Fixed dropdown clipping, keyboard navigation, focus retention, and chip clearing behavior.

## [v0.2.0] - 2026-07-11

### Added
- **Tag-based multi-filter search** in the Mailbox tab: the search box is now a tags
  input — type tokens like `tag:Promotions`, `from:amazon`, `method:oneclick`,
  `subject:invoice`, `is:unread`, `older_than:6m`, `larger:5M`, or free text, press
  Enter to build chips, and run them all with one explicit **Search**. Chips of the
  same field OR together; different fields AND together.
  - Cache-answerable chips filter the scanned sender list instantly, with no network call.
  - Queries containing Gmail-only chips (`is:` / `older_than:` / `newer_than:` / `larger:`)
    compile to a single sanitized Gmail search and open in the message panel
    (view and label only — bulk trash remains limited to the allow-listed quick-filter presets).
  - Autocomplete suggestions for filter prefixes, scan categories, and unsubscribe methods;
    invalid chips render red with an explanatory tooltip and block the search.
- Client test infrastructure (vitest + jsdom + Testing Library) — first automated
  client tests in the repo (43 tests).

### Security
- Closed a DNS-rebinding (check-then-use) window in the one-click unsubscribe SSRF guard:
  the DNS-validated IP is now pinned at connect time on every redirect hop, so requests
  can only reach the address that passed the private-range check.
- Tag-search queries are injection-hardened: Gmail metacharacters are stripped, free-text
  terms are always quoted so operator-lookalikes (`in:trash`, `-word`) are searched as
  literal text, and cache-only `method:` chips are never forwarded to Gmail.
- Security audit and code-review hardening fixes across server routes and services
  (session/CSRF handling, input validation).

### Fixed
- `method:` chips no longer degrade into misleading free-text words when a search is
  routed to Gmail — they apply to cached-scan filtering only and are skipped in the
  compiled query (documented in FEATURES.md §7a).

<!-- recommended-semver-bump: minor -->
