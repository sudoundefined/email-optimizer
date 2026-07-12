# Tag-Based Multi-Filter Search — Design

**Date:** 2026-07-11
**Status:** Approved by user (brainstorming session)

## Summary

Replace the plain "Search senders…" text box in the Mailbox tab with a **tags input**: the user builds a set of filter chips (e.g. `tag:promotions`, `from:amazon`, `is:unread`), then clicks **Search** to run them all as one combined query. Filtering is **hybrid**: chips answerable from the cached scan data filter the sender table client-side; queries containing Gmail-only chips compile to a single Gmail query string and show matching messages in the existing message panel. **No server changes.**

## UX

The `TagSearchInput` component replaces the current search box in `MailboxTab.tsx` (currently lines 713–720, backed by a `useState('')` at line 215).

- **Chip creation:** typing a token and pressing Enter creates a chip. A suggestion dropdown appears while typing, offering:
  - field prefixes: `tag:`, `from:`, `method:`, `subject:`, `is:unread`, `older_than:`, `newer_than:`, `larger:`
  - valid values per field: the 18 categories for `tag:` (sourced from already-loaded suggestion data), `oneclick | mailto | link | none` for `method:`
  - text without a recognized prefix becomes a **free-text chip**
- **Chip deletion:** × button on each chip; Backspace on an empty input removes the last chip.
- **Explicit trigger:** filtering runs **only** when the user clicks **Search** (or presses Enter on an empty input with chips present). Building/removing chips does not filter live.
- **Clear:** removes all chips and restores the unfiltered view.
- **Validation feedback:** an invalid value for a validated field (e.g. `tag:banana`, malformed `older_than:` duration, malformed `larger:` size) renders the chip red with an error tooltip and disables Search until fixed or removed. An unrecognized field prefix is not an error — the token becomes a free-text chip with a hint.

## Query semantics

Chips split into two groups:

| Group | Fields | Resolved against |
| --- | --- | --- |
| **Sender-field chips** | `tag:`, `from:`, `method:`, `subject:`, free text | Cached `Sender[]` + `suggestionMap` (client-side, instant) |
| **Gmail-only chips** | `is:unread`, `older_than:`, `newer_than:`, `larger:` | Gmail API via existing `GET /api/inbox/filter?q=` |

**Routing rule:** if the applied chip set contains **any** Gmail-only chip, the **entire** set compiles to one Gmail query string (e.g. `from:amazon category:promotions is:unread`) and results open in the existing message panel — the same path the quick-filter preset pills use today. Otherwise all chips filter the cached sender table in place.

**Combining rule:** OR within a field, AND across fields.
`tag:promotions tag:social from:amazon` ⇒ `(category = promotions OR social) AND from matches amazon`.
Free-text chips AND together; each matches sender name, email, or latest subject as a case-insensitive substring (same fields the current search matches).

**Field → data mapping (client-side path):**

- `tag:` → `suggestionMap.get(sender.email)?.category`
- `from:` → substring over `sender.email`, `sender.name`, `sender.domain`
- `method:` → exact match on `sender.method`
- `subject:` → substring over `sender.latestSubject`
- free text → substring over name / email / latestSubject

**Field → Gmail `q` mapping (server path):**

- `tag:x` → `category:x` for Gmail-native categories (promotions, social, updates, forums). For the app's other taxonomy categories, map to `label:"<prefix><Category>"` using the user's configured label prefix (from preferences, default `Unsub/`). Note: this only matches mail the user has already labeled — the chip shows an info tooltip saying so when routed to Gmail.
- `from:x` → `from:x`; `subject:x` → `subject:"x"`; free text → quoted bare term
- `is:unread`, `older_than:Nd|m|y`, `newer_than:…`, `larger:NM` → passed through as-is after validation

**Safety:** search results are view/label only. Bulk trash keeps its existing allow-listed-preset-key-only model (`POST /api/inbox/filter/:key/trash`); free-form queries never gain a trash path (per CLAUDE.md injection rule #8).

## Architecture

Two new client pieces; **zero server changes**.

### 1. `client/src/utils/searchQuery.ts` — pure logic module (no React)

- `parseToken(text): Chip` — `Chip = { field: 'tag'|'from'|'method'|'subject'|'is'|'older_than'|'newer_than'|'larger'|'text', value: string, valid: boolean, error?: string }`
- `getSuggestions(partial: string, categories: string[]): Suggestion[]` — drives the dropdown
- `filterSenders(senders: Sender[], suggestionMap: Map<string, Suggestion>, chips: Chip[]): Sender[]` — OR-within/AND-across over cached data
- `needsGmail(chips: Chip[]): boolean`
- `compileGmailQuery(chips: Chip[]): string` — values sanitized: quotes stripped/escaped, values with spaces wrapped in double quotes

### 2. `client/src/components/TagSearchInput.tsx` — presentational component

Chakra `Tag` chips, suggestion `Menu`, Search and Clear buttons. Props: `chips`, `onChipsChange`, `onSearch`, `onClear`, `categories`. Holds only the in-progress text input state; the chip list is owned by the parent.

### 3. `MailboxTab.tsx` wiring

- Replace `search: string` state with `chips: Chip[]` (being edited) and `activeSearch: Chip[]` (the set applied when Search was last clicked).
- `visibleSenders` useMemo (currently lines 555–576): replace the substring block with `filterSenders(..., activeSearch)`; segment/category facets and sorting are unchanged.
- On Search: if `needsGmail(chips)` → `api.filterMessages(compileGmailQuery(chips))` and open the existing message panel; else set `activeSearch` and let the table re-filter.
- Category list for `tag:` suggestions comes from the already-loaded suggestion data — no new fetches.

## Error handling

- **Invalid validated-field value** → red chip + tooltip, Search disabled. Never silently dropped.
- **Unknown prefix** → becomes a free-text chip with a hint.
- **Gmail request failure** (401/429/network) → the existing toast pattern MailboxTab uses for `filterMessages`; chips preserved for retry.
- **Empty results** → existing empty states (sender table "no matches" / message panel empty view).
- **Query injection into `q`** → values are escaped/quoted in `compileGmailQuery`; the endpoint is read-only, and trash remains key-allow-listed, so worst case is a wrong result set.

## Testing

- **Unit (vitest), `searchQuery.test.ts`:** parseToken for every field + invalid values; filterSenders OR/AND combinations over a fixture sender list; compileGmailQuery output including quoting/escaping and the tag→category/label mapping; needsGmail routing.
- **Component test, `TagSearchInput`:** Enter creates chip; Backspace deletes; suggestion selection; Search emits chips; invalid chip disables Search.
- **Manual verification** (dev server): cache-only query filters the sender table; adding `is:unread` routes to the message panel; Clear restores the full table.

## Out of scope (YAGNI)

- Saved searches / persisting chip sets
- Free-form-query bulk trash (deliberate safety exclusion)
- Extending the scan payload with unread/date/size per sender
- NOT/negation operators and nested boolean grouping
