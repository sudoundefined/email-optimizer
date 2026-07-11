# Tag-Based Multi-Filter Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain "Search senders…" box in the Mailbox tab with a tags-input that combines multiple filter chips (`tag:Promotions`, `from:amazon`, `is:unread`, …) into one search, executed on an explicit Search click, with hybrid client/Gmail routing.

**Architecture:** A pure TypeScript module `client/src/utils/searchQuery.ts` (parse, suggest, filter, compile) + a presentational `TagSearchInput` component, wired into `MailboxTab.tsx`. Cache-answerable chips filter the in-memory sender list; queries containing Gmail-only chips compile to a Gmail `q` string sent through the **existing** `GET /api/inbox/filter?q=` endpoint and render in the existing message panel. **Zero server changes.**

**Tech Stack:** React 18 + TypeScript + Chakra UI v2 (client), vitest + jsdom + @testing-library/react (new client test infra), existing Express/Gmail backend untouched.

**Spec:** `docs/superpowers/specs/2026-07-11-tag-search-design.md`

## Global Constraints

- Client HTTP calls go through `api.ts` methods only; response interfaces live in `types.ts` (CLAUDE.md pattern 7).
- Bulk trash stays allow-listed-key-only (`POST /api/inbox/filter/:key/trash`); the free-form tag-search query must NEVER gain a trash path (CLAUDE.md pattern 8). Search results are view/label only.
- UI: semantic tokens only (`bg.*`, `text.*`, `border.*`, `brand.*`, `neutral.*`) — never hard-code hex. Pill shapes (`borderRadius="full"`) for buttons/tags, weight 600. Verify in both themes × light/dark.
- No new server dependencies; client gets dev-only test dependencies (vitest, jsdom, @testing-library/react).
- Commit after every task; run `npm run build -w client` (tsc + vite) before the final commit of any task that touches client TS.
- All file paths below are relative to the repo root `C:\Users\deepa\email-unsubscriber`.

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `client/vitest.config.ts` | Create | vitest config (jsdom, setup file) |
| `client/vitest.setup.ts` | Create | `window.matchMedia` stub for Chakra in jsdom |
| `client/package.json` | Modify | add `test` script + dev deps |
| `client/src/utils/searchQuery.ts` | Create | pure logic: Chip type, parseToken, getSuggestions, filterSenders, needsGmail, compileGmailQuery |
| `client/src/utils/searchQuery.test.ts` | Create | unit tests for the module |
| `client/src/components/TagSearchInput.tsx` | Create | chips input UI (presentational, controlled) |
| `client/src/components/TagSearchInput.test.tsx` | Create | component tests |
| `client/src/api.ts` | Modify | add `userPreferences()` method |
| `client/src/components/MailboxTab.tsx` | Modify | replace search state/box, hybrid routing, message-panel branch |
| `FEATURES.md`, `ARCHITECTURE.md` | Modify | document the feature |

---

### Task 1: Client test infrastructure (vitest)

The client has **no test runner today** (`client/package.json` has no `test` script; the root `npm test -ws --if-present` skips it). Set up vitest so Tasks 2–5 can do TDD.

**Files:**
- Modify: `client/package.json`
- Create: `client/vitest.config.ts`
- Create: `client/vitest.setup.ts`
- Create: `client/src/utils/searchQuery.test.ts` (smoke test only; real tests come in Task 2)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test -w client` runs vitest once (CI-style). `npm test -w client -- <path>` runs a single file. Tasks 2–5 rely on this.

- [ ] **Step 1: Install dev dependencies**

```bash
cd C:\Users\deepa\email-unsubscriber
npm install -D vitest jsdom @testing-library/react -w client
```

Expected: `package.json` in `client/` gains the three devDependencies; install exits 0.

- [ ] **Step 2: Add the test script**

In `client/package.json`, change the `scripts` block from:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
```

to:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Create vitest config and setup files**

Create `client/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

Create `client/vitest.setup.ts` (Chakra v2 calls `window.matchMedia` on render; jsdom lacks it):

```ts
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
```

- [ ] **Step 4: Create a smoke test and verify the runner works**

Create `client/src/utils/searchQuery.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest infrastructure', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test -w client`
Expected: `1 passed` — the runner discovers and passes the smoke test.

- [ ] **Step 5: Verify the client still builds (test files must not break tsc)**

Run: `npm run build -w client`
Expected: exits 0. (If `tsc -b` complains it cannot find vitest types, confirm `vitest` is in `client/node_modules` — the `import { describe … } from 'vitest'` style used here needs no tsconfig `types` entry.)

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/vitest.config.ts client/vitest.setup.ts client/src/utils/searchQuery.test.ts package-lock.json
git commit -m "test(client): add vitest + jsdom + testing-library infrastructure"
```

---

### Task 2: `searchQuery.ts` — Chip type, `parseToken`, `getSuggestions`

**Files:**
- Create: `client/src/utils/searchQuery.ts`
- Modify: `client/src/utils/searchQuery.test.ts` (replace smoke test)

**Interfaces:**
- Consumes: `Sender`, `Suggestion` types from `client/src/types.ts` (already exist, see types.ts:3-11 and 67-73).
- Produces (used by Tasks 3–6):
  ```ts
  export type ChipField = 'tag' | 'from' | 'method' | 'subject' | 'is' | 'older_than' | 'newer_than' | 'larger' | 'text'
  export interface Chip { field: ChipField; value: string; valid: boolean; error?: string; note?: string }
  export function parseToken(raw: string, categories: string[]): Chip
  export function getSuggestions(partial: string, categories: string[]): string[]
  ```
  `categories` is the app's category list observed in the current scan (e.g. `['Promotions', 'Newsletters', 'Social']`); `parseToken` canonicalizes `tag:` values to the exact casing found in that list.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `client/src/utils/searchQuery.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { parseToken, getSuggestions } from './searchQuery'

const CATEGORIES = ['Promotions', 'Newsletters', 'Social', 'Food & Dining']

describe('parseToken', () => {
  it('parses a valid tag chip and canonicalizes casing', () => {
    expect(parseToken('tag:promotions', CATEGORIES)).toEqual({ field: 'tag', value: 'Promotions', valid: true })
  })

  it('rejects an unknown tag value', () => {
    const chip = parseToken('tag:banana', CATEGORIES)
    expect(chip.field).toBe('tag')
    expect(chip.valid).toBe(false)
    expect(chip.error).toContain('banana')
  })

  it('parses from and subject chips', () => {
    expect(parseToken('from:amazon', CATEGORIES)).toEqual({ field: 'from', value: 'amazon', valid: true })
    expect(parseToken('subject:invoice due', CATEGORIES)).toEqual({ field: 'subject', value: 'invoice due', valid: true })
  })

  it('rejects an empty from value', () => {
    expect(parseToken('from:', CATEGORIES).valid).toBe(false)
  })

  it('parses and lowercases a valid method chip; rejects unknown methods', () => {
    expect(parseToken('method:OneClick', CATEGORIES)).toEqual({ field: 'method', value: 'oneclick', valid: true })
    expect(parseToken('method:carrier-pigeon', CATEGORIES).valid).toBe(false)
  })

  it('accepts only is:unread', () => {
    expect(parseToken('is:unread', CATEGORIES)).toEqual({ field: 'is', value: 'unread', valid: true })
    expect(parseToken('is:starred', CATEGORIES).valid).toBe(false)
  })

  it('validates older_than / newer_than durations', () => {
    expect(parseToken('older_than:6m', CATEGORIES)).toEqual({ field: 'older_than', value: '6m', valid: true })
    expect(parseToken('newer_than:14d', CATEGORIES)).toEqual({ field: 'newer_than', value: '14d', valid: true })
    expect(parseToken('older_than:soon', CATEGORIES).valid).toBe(false)
  })

  it('validates larger sizes and uppercases the unit', () => {
    expect(parseToken('larger:5m', CATEGORIES)).toEqual({ field: 'larger', value: '5M', valid: true })
    expect(parseToken('larger:500K', CATEGORIES)).toEqual({ field: 'larger', value: '500K', valid: true })
    expect(parseToken('larger:big', CATEGORIES).valid).toBe(false)
  })

  it('treats bare text as a valid free-text chip', () => {
    expect(parseToken('  amazon deals ', CATEGORIES)).toEqual({ field: 'text', value: 'amazon deals', valid: true })
  })

  it('treats an unknown prefix as free text with a note, not an error', () => {
    const chip = parseToken('foo:bar', CATEGORIES)
    expect(chip.field).toBe('text')
    expect(chip.value).toBe('foo:bar')
    expect(chip.valid).toBe(true)
    expect(chip.note).toContain('foo')
  })
})

describe('getSuggestions', () => {
  it('offers all field prefixes for empty input', () => {
    expect(getSuggestions('', CATEGORIES)).toEqual([
      'tag:', 'from:', 'method:', 'subject:', 'is:unread', 'older_than:', 'newer_than:', 'larger:',
    ])
  })

  it('completes field prefixes from a partial word', () => {
    expect(getSuggestions('meth', CATEGORIES)).toEqual(['method:'])
    expect(getSuggestions('is', CATEGORIES)).toEqual(['is:unread'])
  })

  it('suggests category values after tag:', () => {
    expect(getSuggestions('tag:', CATEGORIES)).toEqual([
      'tag:Promotions', 'tag:Newsletters', 'tag:Social', 'tag:Food & Dining',
    ])
    expect(getSuggestions('tag:pro', CATEGORIES)).toEqual(['tag:Promotions'])
  })

  it('suggests method values after method:', () => {
    expect(getSuggestions('method:m', CATEGORIES)).toEqual(['method:mailto'])
  })

  it('returns nothing for text that matches no prefix', () => {
    expect(getSuggestions('zzz', CATEGORIES)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w client -- src/utils/searchQuery.test.ts`
Expected: FAIL — `Cannot find module './searchQuery'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `client/src/utils/searchQuery.ts`:

```ts
/**
 * Pure logic for the tag-based multi-filter search (no React).
 * Spec: docs/superpowers/specs/2026-07-11-tag-search-design.md
 */
import type { Sender, Suggestion } from '../types'

export type ChipField =
  | 'tag' | 'from' | 'method' | 'subject' // resolvable against the cached scan
  | 'is' | 'older_than' | 'newer_than' | 'larger' // Gmail-only
  | 'text'

export interface Chip {
  field: ChipField
  value: string
  valid: boolean
  error?: string
  note?: string
}

const METHODS = ['oneclick', 'mailto', 'link', 'none'] as const
const GMAIL_ONLY: ReadonlySet<ChipField> = new Set(['is', 'older_than', 'newer_than', 'larger'])
const FIELD_PREFIXES = ['tag:', 'from:', 'method:', 'subject:', 'is:unread', 'older_than:', 'newer_than:', 'larger:']

export function parseToken(raw: string, categories: string[]): Chip {
  const text = raw.trim()
  const m = text.match(/^([a-z_]+):(.*)$/i)
  if (!m) return { field: 'text', value: text, valid: text.length > 0, ...(text ? {} : { error: 'Empty token' }) }
  const prefix = m[1].toLowerCase()
  const value = m[2].trim()
  switch (prefix) {
    case 'tag': {
      const match = categories.find((c) => c.toLowerCase() === value.toLowerCase())
      if (!match) return { field: 'tag', value, valid: false, error: `Unknown tag "${value}" — pick a category from your scan` }
      return { field: 'tag', value: match, valid: true }
    }
    case 'method': {
      const v = value.toLowerCase()
      if (!(METHODS as readonly string[]).includes(v))
        return { field: 'method', value, valid: false, error: `Method must be one of: ${METHODS.join(', ')}` }
      return { field: 'method', value: v, valid: true }
    }
    case 'from':
    case 'subject':
      if (!value) return { field: prefix, value, valid: false, error: `${prefix}: needs a value` }
      return { field: prefix, value, valid: true }
    case 'is':
      if (value.toLowerCase() !== 'unread')
        return { field: 'is', value, valid: false, error: 'Only is:unread is supported' }
      return { field: 'is', value: 'unread', valid: true }
    case 'older_than':
    case 'newer_than':
      if (!/^\d+[dmy]$/.test(value))
        return { field: prefix, value, valid: false, error: 'Use Nd, Nm or Ny — e.g. older_than:6m' }
      return { field: prefix, value, valid: true }
    case 'larger':
      if (!/^\d+[km]?$/i.test(value))
        return { field: 'larger', value, valid: false, error: 'Use a size like 5M or 500K' }
      return { field: 'larger', value: value.toUpperCase(), valid: true }
    default:
      // Unrecognized prefix is not an error — match the whole token as free text.
      return { field: 'text', value: text, valid: true, note: `Unknown filter "${prefix}:" — matching as plain text` }
  }
}

export function getSuggestions(partial: string, categories: string[]): string[] {
  const p = partial.trim().toLowerCase()
  if (!p) return [...FIELD_PREFIXES]
  if (p.startsWith('tag:')) {
    const v = p.slice(4)
    return categories.filter((c) => c.toLowerCase().startsWith(v)).map((c) => `tag:${c}`)
  }
  if (p.startsWith('method:')) {
    const v = p.slice(7)
    return METHODS.filter((mth) => mth.startsWith(v)).map((mth) => `method:${mth}`)
  }
  return FIELD_PREFIXES.filter((f) => f.startsWith(p) && f !== p)
}
```

(Note: `Sender`/`Suggestion`/`GMAIL_ONLY` imports/constants are unused until Tasks 3–4 — that is fine, TypeScript `noUnusedLocals` may flag them; if `npm run build -w client` complains, add them in Task 3 instead and keep only what compiles now.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w client -- src/utils/searchQuery.test.ts`
Expected: PASS — all `parseToken` and `getSuggestions` tests green.

- [ ] **Step 5: Verify the build**

Run: `npm run build -w client`
Expected: exits 0. If `noUnusedLocals` errors on `Sender`/`Suggestion`/`GMAIL_ONLY`, remove them from this task's code (they are reintroduced in Tasks 3–4).

- [ ] **Step 6: Commit**

```bash
git add client/src/utils/searchQuery.ts client/src/utils/searchQuery.test.ts
git commit -m "feat(client): tag-search token parser and suggestions"
```

---

### Task 3: `searchQuery.ts` — `filterSenders`

**Files:**
- Modify: `client/src/utils/searchQuery.ts`
- Modify: `client/src/utils/searchQuery.test.ts`

**Interfaces:**
- Consumes: `Chip` from Task 2; `Sender` (types.ts:3-11: `{email, name, domain, messageCount, latestSubject, latestDate, method}`), `Suggestion` (types.ts:67-73: `{senderEmail, …, category}`).
- Produces (used by Task 6):
  ```ts
  export function filterSenders(senders: Sender[], suggestionMap: Map<string, Suggestion>, chips: Chip[]): Sender[]
  ```
  Semantics: OR within a field, AND across fields; free-text chips AND together, each substring-matching name/email/latestSubject (case-insensitive); `from:` matches email/name/domain; invalid chips and Gmail-only chips are ignored.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/utils/searchQuery.test.ts`:

```ts
import { filterSenders } from './searchQuery'
import type { Sender, Suggestion } from '../types'

const SENDERS: Sender[] = [
  { email: 'deals@amazon.com', name: 'Amazon Deals', domain: 'amazon.com', messageCount: 40, latestSubject: 'Big sale today', latestDate: 1700000000000, method: 'oneclick' },
  { email: 'news@nytimes.com', name: 'NYT Briefing', domain: 'nytimes.com', messageCount: 12, latestSubject: 'Morning briefing', latestDate: 1700000001000, method: 'link' },
  { email: 'noreply@facebook.com', name: 'Facebook', domain: 'facebook.com', messageCount: 7, latestSubject: 'You have notifications', latestDate: 1700000002000, method: 'none' },
]

function sugg(email: string, category: string): [string, Suggestion] {
  return [email, { senderEmail: email, messageCount: 1, category, confidence: 'high', reason: '' }]
}

const SUGGESTION_MAP = new Map<string, Suggestion>([
  sugg('deals@amazon.com', 'Promotions'),
  sugg('news@nytimes.com', 'Newsletters'),
  sugg('noreply@facebook.com', 'Social'),
])

const emails = (list: Sender[]) => list.map((s) => s.email)

describe('filterSenders', () => {
  it('returns all senders for an empty chip list', () => {
    expect(filterSenders(SENDERS, SUGGESTION_MAP, [])).toEqual(SENDERS)
  })

  it('filters by a single tag chip', () => {
    const chips = [parseToken('tag:Promotions', ['Promotions'])]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com'])
  })

  it('ORs multiple chips of the same field', () => {
    const cats = ['Promotions', 'Social']
    const chips = [parseToken('tag:Promotions', cats), parseToken('tag:Social', cats)]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com', 'noreply@facebook.com'])
  })

  it('ANDs chips across different fields', () => {
    const cats = ['Promotions', 'Social']
    const chips = [parseToken('tag:Promotions', cats), parseToken('tag:Social', cats), parseToken('from:amazon', cats)]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com'])
  })

  it('matches from: against email, name, and domain', () => {
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('from:nytimes.com', [])]))).toEqual(['news@nytimes.com'])
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('from:facebook', [])]))).toEqual(['noreply@facebook.com'])
  })

  it('filters by method and subject', () => {
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('method:none', [])]))).toEqual(['noreply@facebook.com'])
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, [parseToken('subject:briefing', [])]))).toEqual(['news@nytimes.com'])
  })

  it('ANDs free-text chips together', () => {
    const chips = [parseToken('amazon', []), parseToken('sale', [])]
    expect(emails(filterSenders(SENDERS, SUGGESTION_MAP, chips))).toEqual(['deals@amazon.com'])
    const noMatch = [parseToken('amazon', []), parseToken('briefing', [])]
    expect(filterSenders(SENDERS, SUGGESTION_MAP, noMatch)).toEqual([])
  })

  it('ignores invalid chips and Gmail-only chips', () => {
    const chips = [parseToken('tag:banana', ['Promotions']), parseToken('is:unread', [])]
    expect(filterSenders(SENDERS, SUGGESTION_MAP, chips)).toEqual(SENDERS)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w client -- src/utils/searchQuery.test.ts`
Expected: FAIL — `filterSenders` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `client/src/utils/searchQuery.ts` (and ensure the `import type { Sender, Suggestion } from '../types'` line from Task 2 is present at the top):

```ts
function includesCI(haystack: string | undefined | null, needle: string): boolean {
  return (haystack || '').toLowerCase().includes(needle.toLowerCase())
}

function groupChips(chips: Chip[]): Map<ChipField, Chip[]> {
  const groups = new Map<ChipField, Chip[]>()
  for (const c of chips) {
    if (!c.valid) continue
    const list = groups.get(c.field) ?? []
    list.push(c)
    groups.set(c.field, list)
  }
  return groups
}

/** OR within a field, AND across fields; free-text chips AND together. */
export function filterSenders(
  senders: Sender[],
  suggestionMap: Map<string, Suggestion>,
  chips: Chip[]
): Sender[] {
  const groups = groupChips(chips)
  if (groups.size === 0) return senders
  return senders.filter((s) => {
    for (const [field, group] of groups) {
      let match: boolean
      switch (field) {
        case 'tag': {
          const cat = suggestionMap.get(s.email)?.category
          match = group.some((c) => c.value === cat)
          break
        }
        case 'from':
          match = group.some((c) => includesCI(s.email, c.value) || includesCI(s.name, c.value) || includesCI(s.domain, c.value))
          break
        case 'method':
          match = group.some((c) => s.method === c.value)
          break
        case 'subject':
          match = group.some((c) => includesCI(s.latestSubject, c.value))
          break
        case 'text':
          match = group.every((c) => includesCI(s.name, c.value) || includesCI(s.email, c.value) || includesCI(s.latestSubject, c.value))
          break
        default:
          match = true // Gmail-only fields are not resolvable against the cache
      }
      if (!match) return false
    }
    return true
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w client -- src/utils/searchQuery.test.ts`
Expected: PASS — all tests including the Task 2 suites.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/searchQuery.ts client/src/utils/searchQuery.test.ts
git commit -m "feat(client): tag-search client-side sender filtering (OR-within, AND-across)"
```

---

### Task 4: `searchQuery.ts` — `needsGmail` + `compileGmailQuery`

**Files:**
- Modify: `client/src/utils/searchQuery.ts`
- Modify: `client/src/utils/searchQuery.test.ts`

**Interfaces:**
- Consumes: `Chip`, `groupChips` from earlier tasks.
- Produces (used by Task 6):
  ```ts
  export function needsGmail(chips: Chip[]): boolean
  export function compileGmailQuery(chips: Chip[], labelPrefix: string): string
  ```
  Mapping: `tag:Promotions|Social` → `category:promotions|social` (Gmail-native); any other tag → `label:<labelPrefix><Category>` (quoted if it contains spaces); `from:`/`subject:` pass through quoted; free text → quoted bare term; `is:`/`older_than:`/`newer_than:`/`larger:` pass through. Values are sanitized (quotes/braces/parens stripped) and space-containing values wrapped in `"…"`. Same-field groups render as `(a OR b)`.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/utils/searchQuery.test.ts`:

```ts
import { needsGmail, compileGmailQuery } from './searchQuery'

const CATS = ['Promotions', 'Social', 'Newsletters', 'Food & Dining']

describe('needsGmail', () => {
  it('is false for cache-answerable chips', () => {
    expect(needsGmail([parseToken('tag:Promotions', CATS), parseToken('from:amazon', CATS)])).toBe(false)
  })
  it('is true when any Gmail-only chip is present', () => {
    expect(needsGmail([parseToken('from:amazon', CATS), parseToken('is:unread', CATS)])).toBe(true)
    expect(needsGmail([parseToken('older_than:6m', CATS)])).toBe(true)
    expect(needsGmail([parseToken('larger:5M', CATS)])).toBe(true)
  })
  it('ignores invalid chips', () => {
    expect(needsGmail([parseToken('is:starred', CATS)])).toBe(false)
  })
})

describe('compileGmailQuery', () => {
  const P = 'Unsub/'

  it('maps Gmail-native tags to category:', () => {
    expect(compileGmailQuery([parseToken('tag:Promotions', CATS)], P)).toBe('category:promotions')
    expect(compileGmailQuery([parseToken('tag:Social', CATS)], P)).toBe('category:social')
  })

  it('maps non-native tags to the prefixed label, quoting spaces', () => {
    expect(compileGmailQuery([parseToken('tag:Newsletters', CATS)], P)).toBe('label:Unsub/Newsletters')
    expect(compileGmailQuery([parseToken('tag:Food & Dining', CATS)], P)).toBe('label:"Unsub/Food & Dining"')
  })

  it('ORs same-field chips and ANDs across fields', () => {
    const chips = [parseToken('tag:Promotions', CATS), parseToken('tag:Social', CATS), parseToken('is:unread', CATS)]
    expect(compileGmailQuery(chips, P)).toBe('(category:promotions OR category:social) is:unread')
  })

  it('passes through from/subject/is/older_than/newer_than/larger', () => {
    const chips = [
      parseToken('from:amazon', CATS),
      parseToken('subject:order shipped', CATS),
      parseToken('older_than:6m', CATS),
      parseToken('larger:5M', CATS),
    ]
    expect(compileGmailQuery(chips, P)).toBe('from:amazon subject:"order shipped" older_than:6m larger:5M')
  })

  it('quotes free text with spaces and ANDs multiple text chips', () => {
    const chips = [parseToken('big sale', CATS), parseToken('amazon', CATS)]
    expect(compileGmailQuery(chips, P)).toBe('"big sale" amazon')
  })

  it('strips quotes, braces, and parens from values (injection defense)', () => {
    expect(compileGmailQuery([parseToken('from:a"b{c}(d)', CATS)], P)).toBe('from:abcd')
  })

  it('skips invalid chips', () => {
    const chips = [parseToken('tag:banana', CATS), parseToken('from:amazon', CATS)]
    expect(compileGmailQuery(chips, P)).toBe('from:amazon')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w client -- src/utils/searchQuery.test.ts`
Expected: FAIL — `needsGmail` / `compileGmailQuery` not exported.

- [ ] **Step 3: Write the implementation**

Append to `client/src/utils/searchQuery.ts` (the `GMAIL_ONLY` set was defined in Task 2; add it if it was removed for unused-locals):

```ts
/** App categories that map 1:1 onto Gmail's native category: operator. */
const GMAIL_NATIVE_TAGS: Record<string, string> = {
  promotions: 'promotions',
  social: 'social',
}

export function needsGmail(chips: Chip[]): boolean {
  return chips.some((c) => c.valid && GMAIL_ONLY.has(c.field))
}

/** Strip Gmail grouping/quoting metacharacters, then quote if spaced. */
function quoteValue(value: string): string {
  const v = value.replace(/["(){}]/g, '')
  return /\s/.test(v) ? `"${v}"` : v
}

export function compileGmailQuery(chips: Chip[], labelPrefix: string): string {
  const groups = groupChips(chips)
  const parts: string[] = []
  for (const [field, group] of groups) {
    const terms = group.map((c) => {
      switch (field) {
        case 'tag': {
          const native = GMAIL_NATIVE_TAGS[c.value.toLowerCase()]
          return native ? `category:${native}` : `label:${quoteValue(labelPrefix + c.value)}`
        }
        case 'from': return `from:${quoteValue(c.value)}`
        case 'subject': return `subject:${quoteValue(c.value)}`
        case 'is': return 'is:unread'
        case 'older_than': return `older_than:${c.value}`
        case 'newer_than': return `newer_than:${c.value}`
        case 'larger': return `larger:${c.value}`
        default: return quoteValue(c.value) // free text
      }
    })
    if (field === 'text' || terms.length === 1) parts.push(...terms) // text ANDs; singletons need no group
    else parts.push(`(${terms.join(' OR ')})`)
  }
  return parts.join(' ')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w client -- src/utils/searchQuery.test.ts`
Expected: PASS — full file green.

- [ ] **Step 5: Verify build**

Run: `npm run build -w client`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add client/src/utils/searchQuery.ts client/src/utils/searchQuery.test.ts
git commit -m "feat(client): compile tag-search chips to a sanitized Gmail query"
```

---

### Task 5: `TagSearchInput` component

**Files:**
- Create: `client/src/components/TagSearchInput.tsx`
- Create: `client/src/components/TagSearchInput.test.tsx`

**Interfaces:**
- Consumes: `Chip`, `parseToken`, `getSuggestions` from `client/src/utils/searchQuery.ts`.
- Produces (used by Task 6):
  ```tsx
  export default function TagSearchInput(props: {
    chips: Chip[]                        // controlled — parent owns the list
    onChipsChange: (next: Chip[]) => void
    onSearch: (chips: Chip[]) => void    // fired ONLY by Search click / Enter-on-empty-input
    onClear: () => void
    categories: string[]                 // for tag: validation + suggestions
    isSearching?: boolean                // shows spinner on the Search button
  }): JSX.Element
  ```
  Behavior contract: Enter with text → add chip; Enter with empty input + ≥1 valid chips → `onSearch`; Backspace on empty input → remove last chip; Search click first converts any leftover input text into a chip, then fires `onSearch` with the combined list; any invalid chip disables Search.

- [ ] **Step 1: Write the failing component tests**

Create `client/src/components/TagSearchInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import TagSearchInput from './TagSearchInput'
import type { Chip } from '../utils/searchQuery'

const CATEGORIES = ['Promotions', 'Social']

function Harness({ onSearch = vi.fn(), onClear = vi.fn() }: { onSearch?: (c: Chip[]) => void; onClear?: () => void }) {
  const [chips, setChips] = useState<Chip[]>([])
  return (
    <ChakraProvider>
      <TagSearchInput chips={chips} onChipsChange={setChips} onSearch={onSearch} onClear={onClear} categories={CATEGORIES} />
    </ChakraProvider>
  )
}

const input = () => screen.getByPlaceholderText(/tag:/i) as HTMLInputElement

describe('TagSearchInput', () => {
  it('creates a chip on Enter and clears the input', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'tag:Promotions' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByText('tag:Promotions')).toBeTruthy()
    expect(input().value).toBe('')
  })

  it('removes the last chip on Backspace when the input is empty', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByText('from:amazon')).toBeTruthy()
    fireEvent.keyDown(input(), { key: 'Backspace' })
    expect(screen.queryByText('from:amazon')).toBeNull()
  })

  it('disables Search while an invalid chip is present', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'tag:banana' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    const search = screen.getByRole('button', { name: /^search$/i }) as HTMLButtonElement
    expect(search.disabled).toBe(true)
  })

  it('fires onSearch with the chips (converting leftover input text first)', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    fireEvent.change(input(), { target: { value: 'tag:Promotions' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    const chips = onSearch.mock.calls[0][0] as Chip[]
    expect(chips.map((c) => `${c.field}:${c.value}`)).toEqual(['tag:Promotions', 'from:amazon'])
  })

  it('fires onSearch on Enter with an empty input and valid chips', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('fires onClear from the Clear button', () => {
    const onClear = vi.fn()
    render(<Harness onClear={onClear} />)
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w client -- src/components/TagSearchInput.test.tsx`
Expected: FAIL — cannot resolve `./TagSearchInput`.

- [ ] **Step 3: Write the component**

Create `client/src/components/TagSearchInput.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import {
  Box, Button, HStack, Input, InputGroup, InputLeftElement, List, ListItem,
  Tag, TagCloseButton, TagLabel, Text, Tooltip, Wrap, WrapItem,
} from '@chakra-ui/react'
import { SearchIcon } from '@chakra-ui/icons'
import { getSuggestions, parseToken } from '../utils/searchQuery'
import type { Chip } from '../utils/searchQuery'

/**
 * Tags input for multi-filter search. Controlled: the parent owns `chips`.
 * onSearch fires ONLY on Search click / Enter-on-empty-input (spec: explicit trigger).
 */
export default function TagSearchInput({
  chips, onChipsChange, onSearch, onClear, categories, isSearching = false,
}: {
  chips: Chip[]
  onChipsChange: (next: Chip[]) => void
  onSearch: (chips: Chip[]) => void
  onClear: () => void
  categories: string[]
  isSearching?: boolean
}) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(
    () => (focused ? getSuggestions(text, categories).slice(0, 8) : []),
    [focused, text, categories]
  )
  const hasInvalid = chips.some((c) => !c.valid)

  const addChip = (raw: string): Chip[] => {
    const trimmed = raw.trim()
    if (!trimmed) return chips
    const next = [...chips, parseToken(trimmed, categories)]
    onChipsChange(next)
    setText('')
    return next
  }

  const pickSuggestion = (s: string) => {
    if (s.endsWith(':')) {
      setText(s)
      inputRef.current?.focus()
    } else {
      addChip(s)
    }
  }

  const handleSearchClick = () => {
    const next = text.trim() ? addChip(text) : chips
    if (next.length > 0 && !next.some((c) => !c.valid)) onSearch(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (text.trim()) addChip(text)
      else if (chips.length > 0 && !hasInvalid) onSearch(chips)
    } else if (e.key === 'Backspace' && !text && chips.length > 0) {
      onChipsChange(chips.slice(0, -1))
    }
  }

  return (
    <Box position="relative">
      {chips.length > 0 && (
        <Wrap mb={2} spacing={2}>
          {chips.map((chip, i) => (
            <WrapItem key={`${chip.field}:${chip.value}:${i}`}>
              <Tooltip label={chip.error ?? chip.note} isDisabled={!chip.error && !chip.note} hasArrow>
                <Tag
                  size="sm"
                  borderRadius="full"
                  fontWeight={600}
                  colorScheme={chip.valid ? 'brand' : 'red'}
                  variant={chip.valid ? 'subtle' : 'solid'}
                >
                  <TagLabel>{chip.field === 'text' ? chip.value : `${chip.field}:${chip.value}`}</TagLabel>
                  <TagCloseButton
                    aria-label={`Remove ${chip.value}`}
                    onClick={() => onChipsChange(chips.filter((_, j) => j !== i))}
                  />
                </Tag>
              </Tooltip>
            </WrapItem>
          ))}
        </Wrap>
      )}
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.400" />
        </InputLeftElement>
        <Input
          ref={inputRef}
          placeholder="tag:Promotions, from:amazon, is:unread…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          borderRadius="md"
        />
      </InputGroup>
      {suggestions.length > 0 && (
        <List
          position="absolute"
          zIndex={10}
          mt={1}
          w="100%"
          bg="bg.card"
          borderRadius="md"
          boxShadow="md"
          border="1px solid"
          borderColor="border.subtle"
          maxH="220px"
          overflowY="auto"
        >
          {suggestions.map((s) => (
            <ListItem
              key={s}
              px={3}
              py={1.5}
              fontSize="sm"
              cursor="pointer"
              _hover={{ bg: 'bg.hover' }}
              onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s) }}
            >
              {s}
            </ListItem>
          ))}
        </List>
      )}
      <HStack mt={2} spacing={2}>
        <Button
          size="xs"
          colorScheme="brand"
          borderRadius="full"
          isDisabled={(chips.length === 0 && !text.trim()) || hasInvalid}
          isLoading={isSearching}
          onClick={handleSearchClick}
        >
          Search
        </Button>
        <Button
          size="xs"
          variant="ghost"
          borderRadius="full"
          isDisabled={chips.length === 0 && !text}
          onClick={() => { setText(''); onClear() }}
        >
          Clear
        </Button>
        {hasInvalid && (
          <Text fontSize="xs" color="red.400">Fix or remove red filters to search</Text>
        )}
      </HStack>
    </Box>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w client -- src/components/TagSearchInput.test.tsx`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Verify build**

Run: `npm run build -w client`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/TagSearchInput.tsx client/src/components/TagSearchInput.test.tsx
git commit -m "feat(client): TagSearchInput chips component with suggestions and explicit Search"
```

---

### Task 6: Wire into MailboxTab (hybrid routing) + `api.userPreferences`

**Files:**
- Modify: `client/src/api.ts` (add one method after `inboxFilters`, api.ts:97)
- Modify: `client/src/components/MailboxTab.tsx` (search state ~line 215, `visibleSenders` ~lines 555-576, search box card ~lines 711-725, message-view header ~lines 779-829, view-reset call sites)

**Interfaces:**
- Consumes: everything from Tasks 2–5; existing `api.filterMessages(q)` (api.ts:98); existing message panel (renders when `isMessageView`); `GET /api/user/preferences` returning `{ labelPrefix?: string, … }` (server route exists — `server/src/routes/user.js:35`; AccountPage already fetches it).
- Produces: the user-facing feature. No new exports consumed by later tasks.

- [ ] **Step 1: Add `userPreferences` to the API client**

In `client/src/api.ts`, after the `inboxFilters` line (line 97), add:

```ts
  userPreferences: () => request<{ labelPrefix?: string }>('/api/user/preferences'),
```

- [ ] **Step 2: Update MailboxTab imports**

In `client/src/components/MailboxTab.tsx` (imports at lines 1-22), add:

```ts
import TagSearchInput from './TagSearchInput'
import { compileGmailQuery, filterSenders, needsGmail } from '../utils/searchQuery'
import type { Chip } from '../utils/searchQuery'
```

- [ ] **Step 3: Replace the search state**

At line 215, replace:

```ts
  const [search, setSearch] = useState('')
```

with:

```ts
  const [chips, setChips] = useState<Chip[]>([])            // being edited in the input
  const [activeSearch, setActiveSearch] = useState<Chip[]>([]) // applied on last Search click
  const [tagSearchQuery, setTagSearchQuery] = useState<string | null>(null) // non-null → Gmail-routed results shown
  const [labelPrefix, setLabelPrefix] = useState('Unsub/')
```

- [ ] **Step 4: Load the label prefix in `loadData`**

In `loadData` (lines 246-263), extend the `Promise.all` array (after `api.inboxFilters(),`):

```ts
        api.userPreferences().catch(() => ({} as { labelPrefix?: string })),
```

destructure it (`const [scanRes, suggRes, protRes, subRes, filterRes, prefRes] = await Promise.all([...])`), and after `setFilters(filterRes)` add:

```ts
      if (prefRes.labelPrefix) setLabelPrefix(prefRes.labelPrefix)
```

- [ ] **Step 5: Add the search handlers**

After `handleSenderDrillDown` (ends line 436), add:

```ts
  const runTagSearch = async (searchChips: Chip[]) => {
    setActiveFilter(null)
    setActiveDrillDownSender(null)
    setSelectedMessages(new Set())
    setTrashDone(null)
    if (needsGmail(searchChips)) {
      setActiveSearch([])
      const q = compileGmailQuery(searchChips, labelPrefix)
      setTagSearchQuery(q)
      setMessages(null)
      setMessagesLoading(true)
      try {
        const msgs = await api.filterMessages(q)
        setMessages(msgs)
      } catch (err) {
        handleApiError(err)
        setTagSearchQuery(null)
      } finally {
        setMessagesLoading(false)
      }
    } else {
      setTagSearchQuery(null)
      setActiveSearch(searchChips)
    }
  }

  const clearTagSearch = () => {
    setChips([])
    setActiveSearch([])
    setTagSearchQuery(null)
  }
```

- [ ] **Step 6: Use `filterSenders` in `visibleSenders`**

In the `visibleSenders` useMemo (lines 555-576), replace the free-text block:

```ts
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.latestSubject || '').toLowerCase().includes(q)
      )
    }
```

with:

```ts
    if (activeSearch.length > 0) list = filterSenders(list, suggestionMap, activeSearch)
```

and change the dependency array from `[scan, segment, category, search, sort, suggestionMap, subMap]` to `[scan, segment, category, activeSearch, sort, suggestionMap, subMap]`.

- [ ] **Step 7: Derive the category list and treat tag search as a message view**

Just after the `categoryCounts` useMemo (ends line 553), add:

```ts
  const categoryList = useMemo(() => categoryCounts.map(([c]) => c), [categoryCounts])
```

At line 580, change:

```ts
  const isMessageView = !!activeFilter || !!activeDrillDownSender
```

to:

```ts
  const isMessageView = !!activeFilter || !!activeDrillDownSender || !!tagSearchQuery
```

- [ ] **Step 8: Clear tag-search results wherever the message view is exited**

Every existing call-site pair `setActiveFilter(null); setActiveDrillDownSender(null)` that resets the view must also reset the Gmail-routed search. Add `setTagSearchQuery(null)` in these three places:

1. "All categories" button onClick (lines 659-663)
2. Category pill onClick (lines 677-681)
3. Segment row onClick (lines 740-745)

Also in `handleFilterSelect` (line 401-407) and `handleSenderDrillDown` (line 420-425), add `setTagSearchQuery(null)` next to the existing resets — selecting a preset or drilling into a sender replaces tag-search results.

- [ ] **Step 9: Replace the search box card**

Replace the search card (lines 711-725):

```tsx
              <Card borderRadius="xl">
                <CardBody p={3}>
                  <InputGroup size="sm">
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder="Search senders…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      borderRadius="md"
                    />
                  </InputGroup>
                </CardBody>
              </Card>
```

with:

```tsx
              <Card borderRadius="xl">
                <CardBody p={3}>
                  <TagSearchInput
                    chips={chips}
                    onChipsChange={setChips}
                    onSearch={runTagSearch}
                    onClear={clearTagSearch}
                    categories={categoryList}
                    isSearching={messagesLoading && !!tagSearchQuery}
                  />
                </CardBody>
              </Card>
```

If `InputGroup`, `InputLeftElement`, `Input`, or `SearchIcon` are now unused in MailboxTab, remove them from the imports (check with the build — `SearchIcon`/`Input` may still be used elsewhere in the file).

- [ ] **Step 10: Handle the tag-search case in the message-view header**

The header (lines 792-798) currently assumes `activeFilter` or `activeDrillDownSender`. Replace:

```tsx
                    <Text fontSize="lg" fontWeight={700} color="text.primary">
                      {activeFilter ? activeFilter.label : activeDrillDownSender!.name || activeDrillDownSender!.email}
                    </Text>
                    <Text fontSize="sm" color="neutral.500" mt={1}>
                      {activeFilter ? 'Viewing filtered messages' : `Browsing emails from ${activeDrillDownSender!.email}`}
                    </Text>
```

with:

```tsx
                    <Text fontSize="lg" fontWeight={700} color="text.primary">
                      {activeFilter
                        ? activeFilter.label
                        : activeDrillDownSender
                          ? activeDrillDownSender.name || activeDrillDownSender.email
                          : 'Search results'}
                    </Text>
                    <Text fontSize="sm" color="neutral.500" mt={1}>
                      {activeFilter
                        ? 'Viewing filtered messages'
                        : activeDrillDownSender
                          ? `Browsing emails from ${activeDrillDownSender.email}`
                          : `Messages matching your tag search`}
                    </Text>
```

- [ ] **Step 11: Allow "Label all matching" for tag-search results (view/label only — NO trash)**

The action buttons block (lines 806-829) renders Label + Trash only for `activeFilter`. Keep the Trash button `activeFilter`-only (allow-list rule). Make the Label button also available for tag search — change the condition and keep Trash separate:

```tsx
                    {(activeFilter || tagSearchQuery) && (
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="brand"
                        isLoading={filterLabelJob.running}
                        onClick={() => {
                          setCustomLabelArchive(false)
                          setCustomLabelName('')
                          setShowFilterLabelDialog(true)
                        }}
                      >
                        Label all matching
                      </Button>
                    )}
                    {activeFilter && (
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        isLoading={filterTrashJob.running}
                        onClick={() => setConfirmFilterTrash(true)}
                      >
                        Trash all matching
                      </Button>
                    )}
```

And generalize `runFilterLabel` (lines 484-506): replace its first two lines

```ts
  const runFilterLabel = async () => {
    if (!activeFilter || !customLabelName.trim()) return
```

with

```ts
  const runFilterLabel = async () => {
    const labelQuery = activeFilter?.query ?? tagSearchQuery
    if (!labelQuery || !customLabelName.trim()) return
```

and change the `api.applyFilterLabel(activeFilter.query, …)` call (line 492) to `api.applyFilterLabel(labelQuery, …)`.

- [ ] **Step 12: Type-check, run all client tests, and build**

```bash
npm test -w client
npm run build -w client
```

Expected: all vitest suites pass; `tsc -b && vite build` exits 0. Fix any missed `search` references the compiler reports (the old state variable must be fully gone).

- [ ] **Step 13: Manual verification in the running app**

Start the dev environment (`npm run dev` from the repo root; client on :5173) with a connected Gmail account that has scan data, then verify:

1. **Cache path:** add chips `tag:Promotions` + `from:<a known sender domain>` → click Search → sender table narrows instantly; no `/api/inbox/filter` request fires (check the network tab).
2. **Gmail path:** add `is:unread` to the same chips → Search → the message panel opens titled "Search results" listing matching messages; a single `GET /api/inbox/filter?q=…` request fires with the compiled query.
3. **Label-only actions:** in the tag-search message panel, "Label all matching" is visible, "Trash all matching" is NOT.
4. **Exit paths:** clicking a segment, a category pill, or Clear dismisses the search results and restores the table.
5. **Validation:** `tag:banana` chip renders red with tooltip and Search is disabled.
6. **Themes:** repeat a quick visual pass in Botanical Forest + Espresso, light + dark (theme switch in the app header).

Expected: all six pass. If protected by OAuth setup issues, note it and verify with `npm test -w client` + build only, flagging manual steps as pending for the human.

- [ ] **Step 14: Commit**

```bash
git add client/src/api.ts client/src/components/MailboxTab.tsx
git commit -m "feat(client): hybrid tag-based multi-filter search in Mailbox tab"
```

---

### Task 7: Documentation + full-suite verification

**Files:**
- Modify: `FEATURES.md` (feature table/guides)
- Modify: `ARCHITECTURE.md` (client file index)

**Interfaces:**
- Consumes: the shipped feature from Task 6.
- Produces: docs required by the repo's new-feature checklist (CLAUDE.md).

- [ ] **Step 1: Document the feature in FEATURES.md**

Find the section describing search/filtering in the Mailbox tab (search for "Search senders" or "Quick Filters") and add a subsection:

```markdown
### Tag-Based Multi-Filter Search

The Mailbox search box is a tags input: type tokens and press Enter to build filter chips, then click **Search** to run them all at once. Supported chips:

| Chip | Example | Resolved |
| --- | --- | --- |
| `tag:` | `tag:Promotions` | Cached scan (category suggestions) |
| `from:` | `from:amazon` | Cached scan (email/name/domain) |
| `method:` | `method:oneclick` | Cached scan (unsubscribe method) |
| `subject:` | `subject:invoice` | Cached scan (latest subject) |
| free text | `big sale` | Cached scan (name/email/subject) |
| `is:unread` | `is:unread` | Gmail query |
| `older_than:` / `newer_than:` | `older_than:6m` | Gmail query |
| `larger:` | `larger:5M` | Gmail query |

Chips of the same field OR together; different fields AND together. If any Gmail-only chip is present, the whole query compiles to one Gmail search and results open in the message panel (view + label only — bulk trash remains limited to the allow-listed quick-filter presets). `tag:` values without a Gmail-native category map to `label:"<your label prefix><Category>"`, so they only match mail you have already labeled.
```

Adjust placement/heading level to match the file's existing structure.

- [ ] **Step 2: Update the ARCHITECTURE.md file index**

In the client file index section, add rows/entries for:

```
client/src/utils/searchQuery.ts      — tag-search parsing, sender filtering, Gmail query compilation (pure)
client/src/components/TagSearchInput.tsx — chips input with suggestions and explicit Search trigger
```

Follow the file's existing index format exactly.

- [ ] **Step 3: Run the full test suite and build**

```bash
npm test -ws --if-present
npm run build -w client
```

Expected: server `node --test` suites pass (untouched), client vitest suites pass, build exits 0.

- [ ] **Step 4: Commit**

```bash
git add FEATURES.md ARCHITECTURE.md
git commit -m "docs: tag-based multi-filter search feature + file index"
```
