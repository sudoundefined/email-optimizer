# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
