# Gmail Features (Protect-list, Quick-filter, Storage Recovery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three independent features to the email optimizer: sender protect-list (prevent accidental cleanup of important senders), quick-filter toolbar (one-click inbox segment views), and storage recovery dashboard (analytics-driven large/old email cleanup).

**Architecture:** Each feature is additive — no existing routes or components change behavior. Protect-list adds a JSON file store + service + routes + UI integration. Quick-filter adds a backend route for custom Gmail queries + a toolbar component in InboxTab. Storage recovery adds a service that aggregates Gmail message sizes + routes + a new Storage tab with dashboard cards and drill-down.

**Tech Stack:** Express (Node ESM), React/Vite/TypeScript, Gmail API, existing rate limiter (p-limit 20 + exponential backoff), atomic JSON file writes (tmp + rename pattern from tokenStore.js).

## Global Constraints

- No database — Gmail is source of truth; protect-list uses a local JSON file.
- All Gmail API calls go through `limited()` from `rateLimiter.js` + `withAuthErrorHandling` from `oauthClient.js`.
- Atomic file writes: write to `.tmp` then `fs.rename()` (pattern from `server/src/auth/tokenStore.js`).
- Sorting-office design system: use existing CSS tokens (`--ink`, `--airmail-blue`, `--postal-red`, etc.), Archivo font, IBM Plex Mono for data, `.badge` / `.table-card` / `.tray` patterns.
- No new npm dependencies.
- Tests use Node's built-in `node --test` runner.
- Batch modify max = 1000 IDs per call (Gmail hard cap).

---

## File Map

### Feature A: Sender protect-list

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/src/services/protectService.js` | Load/save/query protected senders list, auto-protect heuristics |
| Create | `server/src/routes/protect.js` | REST endpoints: GET/POST/DELETE `/api/protect` |
| Create | `server/test/protectService.test.js` | Unit tests for heuristics + isProtected logic |
| Create | `client/src/components/ProtectedTab.tsx` | Sub-view showing protected senders + unprotect |
| Modify | `server/src/index.js` | Mount protect routes |
| Modify | `server/src/routes/scan.js` | Call autoProtect after scan job completes |
| Modify | `server/src/config.js` | Add `protectedSendersPath` |
| Modify | `client/src/types.ts` | Add `ProtectedSender` interface |
| Modify | `client/src/api.ts` | Add protect API methods |
| Modify | `client/src/components/SendersTab.tsx` | Add Protect/Unprotect buttons to tray, protection warning on trash/unsub |
| Modify | `client/src/App.tsx` | No change needed (protect is a sub-view within Senders) |

### Feature B: Quick-filter toolbar

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `client/src/components/FilterToolbar.tsx` | Horizontal filter buttons + active state |
| Modify | `server/src/routes/inbox.js` | Add GET `/api/inbox/filter/:key/messages` for custom query filters |
| Modify | `server/src/services/inboxService.js` | Add `filterMessages(query, max)` function |
| Modify | `client/src/components/InboxTab.tsx` | Mount FilterToolbar, show filtered results |
| Modify | `client/src/api.ts` | Add `filterMessages()` method |
| Modify | `client/src/types.ts` | Add `Filter` interface |
| Modify | `client/src/styles.css` | Add `.filter-toolbar` styles |

### Feature C: Storage recovery dashboard

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/src/services/storageService.js` | Aggregate message sizes, group by sender/month, find large attachments |
| Create | `server/src/routes/storage.js` | REST endpoints: GET `/api/storage/stats`, `/senders`, `/months`, `/attachments` |
| Create | `server/test/storageService.test.js` | Unit tests for aggregation math |
| Create | `client/src/components/StorageTab.tsx` | Dashboard cards + drill-down message list |
| Modify | `server/src/index.js` | Mount storage routes |
| Modify | `client/src/types.ts` | Add storage interfaces |
| Modify | `client/src/api.ts` | Add storage API methods |
| Modify | `client/src/App.tsx` | Add Storage tab |
| Modify | `client/src/styles.css` | Add storage dashboard styles |

---

### Task 1: Protect-list backend service + tests

**Files:**
- Create: `server/src/services/protectService.js`
- Create: `server/test/protectService.test.js`
- Modify: `server/src/config.js`

**Interfaces:**
- Consumes: `config.protectedSendersPath` (new), `fs` (atomic write pattern from tokenStore.js)
- Produces: `listProtected()`, `protectSenders(emails)`, `unprotectSenders(emails)`, `isProtected(email)`, `autoProtectFromScan(senders)` — all used by Task 2 (routes) and Task 3 (integration)

- [ ] **Step 1: Add config path**

Add `protectedSendersPath` to `server/src/config.js`:

```javascript
// Add after labelRegistryPath line:
protectedSendersPath: path.join(serverRoot, 'data', 'protected-senders.json'),
```

- [ ] **Step 2: Write failing tests**

Create `server/test/protectService.test.js`:

```javascript
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// Override config before importing service
const TEST_PATH = path.join(import.meta.dirname, '..', 'data', 'test-protected-senders.json')

// We need to test the pure functions, so we'll import them after setting up
import {
  PROTECTED_DOMAINS,
  PROTECTED_SUBJECT_KEYWORDS,
  matchesDomainHeuristic,
  matchesSubjectHeuristic,
  autoProtectFromScan,
  listProtected,
  protectSenders,
  unprotectSenders,
  isProtected,
  _setPathForTest,
} from '../src/services/protectService.js'

describe('protectService', () => {
  before(async () => {
    _setPathForTest(TEST_PATH)
    try { await fs.unlink(TEST_PATH) } catch {}
  })
  after(async () => {
    try { await fs.unlink(TEST_PATH) } catch {}
  })

  it('PROTECTED_DOMAINS includes known banks and government', () => {
    assert.ok(PROTECTED_DOMAINS.some(d => d.includes('chase')))
    assert.ok(PROTECTED_DOMAINS.some(d => d.includes('irs.gov')))
  })

  it('matchesDomainHeuristic: exact and subdomain match', () => {
    assert.ok(matchesDomainHeuristic('chase.com'))
    assert.ok(matchesDomainHeuristic('alerts.chase.com'))
    assert.ok(!matchesDomainHeuristic('randomshop.com'))
  })

  it('matchesSubjectHeuristic: detects keywords', () => {
    assert.ok(matchesSubjectHeuristic(['Your January statement is ready']))
    assert.ok(matchesSubjectHeuristic(['Invoice #12345']))
    assert.ok(!matchesSubjectHeuristic(['Check out our sale!']))
  })

  it('autoProtectFromScan: flags domain + subject matches', () => {
    const senders = new Map([
      ['statements@chase.com', { email: 'statements@chase.com', name: 'Chase', domain: 'chase.com', subjects: ['Your statement is ready'] }],
      ['news@randomshop.com', { email: 'news@randomshop.com', name: 'Shop', domain: 'randomshop.com', subjects: ['Big sale!'] }],
      ['billing@example.com', { email: 'billing@example.com', name: 'Example', domain: 'example.com', subjects: ['Your invoice for March'] }],
    ])
    const result = autoProtectFromScan(senders)
    const emails = result.map(r => r.email)
    assert.ok(emails.includes('statements@chase.com'), 'should flag chase (domain)')
    assert.ok(emails.includes('billing@example.com'), 'should flag example (subject keyword)')
    assert.ok(!emails.includes('news@randomshop.com'), 'should not flag random shop')
  })

  it('protectSenders + listProtected + isProtected round-trip', async () => {
    await protectSenders(['a@test.com', 'b@test.com'])
    const list = await listProtected()
    assert.equal(list.length, 2)
    assert.ok(await isProtected('a@test.com'))
    assert.ok(!(await isProtected('c@test.com')))
  })

  it('unprotectSenders removes entries', async () => {
    await protectSenders(['x@test.com', 'y@test.com'])
    await unprotectSenders(['x@test.com'])
    assert.ok(!(await isProtected('x@test.com')))
    assert.ok(await isProtected('y@test.com'))
  })

  it('isProtected is case-insensitive', async () => {
    await protectSenders(['Case@Test.COM'])
    assert.ok(await isProtected('case@test.com'))
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test`
Expected: FAIL — module `protectService.js` does not exist

- [ ] **Step 4: Implement protectService.js**

Create `server/src/services/protectService.js`:

```javascript
import fs from 'node:fs/promises'
import { config } from '../config.js'

let overridePath = null
function filePath() { return overridePath || config.protectedSendersPath }
export function _setPathForTest(p) { overridePath = p }

export const PROTECTED_DOMAINS = [
  'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citi.com', 'capitalone.com',
  'paypal.com', 'venmo.com', 'zelle.com', 'stripe.com',
  'irs.gov', 'uscis.gov', 'ssa.gov', 'usps.com',
  'pge.com', 'sce.com', 'att.com', 'verizon.com', 'tmobile.com', 'xfinity.com', 'comcast.com',
  'amazon.com', 'apple.com', 'google.com', 'microsoft.com',
  'fidelity.com', 'schwab.com', 'vanguard.com', 'etrade.com',
  'geico.com', 'statefarm.com', 'progressive.com', 'allstate.com',
]

export const PROTECTED_SUBJECT_KEYWORDS = [
  'statement', 'invoice', 'receipt', 'bill', 'payment due', 'payment received',
  'tax return', 'tax document', 'w-2', '1099', 'account alert', 'security alert',
  'direct deposit', 'wire transfer', 'insurance',
]

export function matchesDomainHeuristic(domain) {
  const d = domain.toLowerCase()
  return PROTECTED_DOMAINS.some(pd => d === pd || d.endsWith('.' + pd))
}

export function matchesSubjectHeuristic(subjects) {
  if (!subjects || subjects.length === 0) return false
  return subjects.some(s => {
    const lower = s.toLowerCase()
    return PROTECTED_SUBJECT_KEYWORDS.some(kw => lower.includes(kw))
  })
}

/**
 * Analyze scan results and return senders that should be auto-protected.
 * Returns [{email, reason: 'auto:domain'|'auto:subject'}]
 */
export function autoProtectFromScan(senders) {
  const results = []
  for (const [, sender] of senders) {
    if (matchesDomainHeuristic(sender.domain)) {
      results.push({ email: sender.email, reason: 'auto:domain' })
    } else if (matchesSubjectHeuristic(sender.subjects)) {
      results.push({ email: sender.email, reason: 'auto:subject' })
    }
  }
  return results
}

async function readFile() {
  try {
    const raw = await fs.readFile(filePath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return { protected: [] }
  }
}

async function writeFile(data) {
  const dir = filePath().replace(/[/\\][^/\\]+$/, '')
  await fs.mkdir(dir, { recursive: true })
  const tmp = filePath() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, filePath())
}

export async function listProtected() {
  const data = await readFile()
  return data.protected || []
}

export async function protectSenders(emails) {
  const data = await readFile()
  const existing = new Set((data.protected || []).map(p => p.email.toLowerCase()))
  const now = new Date().toISOString()
  for (const email of emails) {
    const lower = email.toLowerCase()
    if (!existing.has(lower)) {
      data.protected.push({ email: lower, reason: 'manual', addedAt: now })
      existing.add(lower)
    }
  }
  await writeFile(data)
  return data.protected
}

export async function unprotectSenders(emails) {
  const data = await readFile()
  const toRemove = new Set(emails.map(e => e.toLowerCase()))
  data.protected = (data.protected || []).filter(p => !toRemove.has(p.email.toLowerCase()))
  await writeFile(data)
  return data.protected
}

export async function isProtected(email) {
  const list = await listProtected()
  const lower = email.toLowerCase()
  return list.some(p => p.email.toLowerCase() === lower)
}

/**
 * Run auto-protect after a scan, merging new auto-detections
 * into the persisted list (won't duplicate existing entries).
 */
export async function runAutoProtect(senders) {
  const detected = autoProtectFromScan(senders)
  if (detected.length === 0) return []
  const data = await readFile()
  const existing = new Set((data.protected || []).map(p => p.email.toLowerCase()))
  const now = new Date().toISOString()
  const added = []
  for (const d of detected) {
    const lower = d.email.toLowerCase()
    if (!existing.has(lower)) {
      data.protected.push({ email: lower, reason: d.reason, addedAt: now })
      existing.add(lower)
      added.push(d)
    }
  }
  if (added.length > 0) await writeFile(data)
  return added
}

/**
 * Filter out protected senders from an email list.
 * Returns {allowed: string[], excluded: string[]}
 */
export async function filterProtected(senderEmails) {
  const list = await listProtected()
  const protectedSet = new Set(list.map(p => p.email.toLowerCase()))
  const allowed = []
  const excluded = []
  for (const email of senderEmails) {
    if (protectedSet.has(email.toLowerCase())) excluded.push(email)
    else allowed.push(email)
  }
  return { allowed, excluded }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test`
Expected: All protectService tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/services/protectService.js server/test/protectService.test.js server/src/config.js
git commit -m "feat: add protectService with domain/subject heuristics and file persistence"
```

---

### Task 2: Protect-list routes + integration into scan/unsubscribe/trash

**Files:**
- Create: `server/src/routes/protect.js`
- Modify: `server/src/index.js`
- Modify: `server/src/routes/scan.js`
- Modify: `server/src/routes/unsubscribe.js` (indirect: trash/unsub check protected)

**Interfaces:**
- Consumes: `protectService.listProtected()`, `protectService.protectSenders()`, `protectService.unprotectSenders()`, `protectService.runAutoProtect()`, `protectService.filterProtected()`
- Produces: REST endpoints `GET/POST/DELETE /api/protect`; scan route auto-protects after scan; trash/unsub routes filter protected senders

- [ ] **Step 1: Create protect routes**

Create `server/src/routes/protect.js`:

```javascript
import { Router } from 'express'
import {
  listProtected,
  protectSenders,
  unprotectSenders,
} from '../services/protectService.js'

const router = Router()

router.get('/protect', async (req, res, next) => {
  try {
    const list = await listProtected()
    res.json({ protected: list })
  } catch (err) { next(err) }
})

router.post('/protect', async (req, res, next) => {
  try {
    const { emails } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' })
    }
    await protectSenders(emails)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.delete('/protect', async (req, res, next) => {
  try {
    const { emails } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails must be a non-empty array' })
    }
    await unprotectSenders(emails)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 2: Mount in index.js**

Add to `server/src/index.js` after other route imports:

```javascript
import protectRoutes from './routes/protect.js'
```

Add after other `app.use('/api', ...)`:

```javascript
app.use('/api', protectRoutes)
```

- [ ] **Step 3: Integrate auto-protect into scan route**

In `server/src/routes/scan.js`, import `runAutoProtect`:

```javascript
import { runAutoProtect } from '../services/protectService.js'
```

After the scan job creates, we need auto-protect to run when the scan completes. Modify the `POST /scan` handler — after `createJob`, the job result triggers autoProtect. Since the job system emits results asynchronously, we hook into scan completion differently. Add a new route:

```javascript
router.post('/scan', (req, res) => {
  if (isJobRunning('scan')) {
    return res.status(409).json({ error: 'scan_already_running' })
  }
  const { range = '6m', maxMessages } = req.body || {}
  const job = createJob('scan', async (emit) => {
    const result = await runScan({ range, maxMessages }, emit)
    // Auto-protect after scan completes
    try {
      const scan = getScan()
      if (scan) {
        const added = await runAutoProtect(scan.senders)
        if (added.length > 0) emit({ phase: 'auto-protect', added: added.length })
      }
    } catch { /* non-fatal */ }
    return result
  })
  res.json({ jobId: job.id })
})
```

- [ ] **Step 4: Integrate protection filter into trash route**

In `server/src/routes/scan.js`, import `filterProtected`:

```javascript
import { runAutoProtect, filterProtected } from '../services/protectService.js'
```

Update the `POST /senders/trash` route to filter protected senders:

```javascript
router.post('/senders/trash', async (req, res, next) => {
  try {
    requireScan()
    const { senderEmails } = req.body || {}
    if (!Array.isArray(senderEmails) || senderEmails.length === 0) {
      return res.status(400).json({ error: 'senderEmails must be a non-empty array' })
    }
    const { allowed, excluded } = await filterProtected(senderEmails)
    if (allowed.length === 0) {
      return res.json({ jobId: null, excluded: excluded.length, message: 'All selected senders are protected' })
    }
    const job = createJob('trash-senders', (emit) => runTrashSenders({ senderEmails: allowed }, emit))
    res.json({ jobId: job.id, excluded: excluded.length })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 5: Run tests + build**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test && cd client && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/protect.js server/src/index.js server/src/routes/scan.js
git commit -m "feat: add protect routes and integrate protection into scan/trash flows"
```

---

### Task 3: Protect-list frontend

**Files:**
- Create: `client/src/components/ProtectedTab.tsx`
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/components/SendersTab.tsx`

**Interfaces:**
- Consumes: `api.protectedList()`, `api.protectSenders()`, `api.unprotectSenders()`, `ProtectedSender` type
- Produces: `ProtectedTab` component, updated sorting tray with Protect/Unprotect buttons

- [ ] **Step 1: Add types**

Add to `client/src/types.ts`:

```typescript
export interface ProtectedSender {
  email: string
  reason: 'auto:domain' | 'auto:subject' | 'manual'
  addedAt: string
}
```

- [ ] **Step 2: Add API methods**

Add to `client/src/api.ts`:

```typescript
protectedList: () => request<{ protected: ProtectedSender[] }>('/api/protect'),
protectSenders: (emails: string[]) =>
  request<{ ok: boolean }>('/api/protect', { method: 'POST', body: JSON.stringify({ emails }) }),
unprotectSenders: (emails: string[]) =>
  request<{ ok: boolean }>('/api/protect', { method: 'DELETE', body: JSON.stringify({ emails }) }),
```

Import `ProtectedSender` in the import list at top of `api.ts`.

- [ ] **Step 3: Create ProtectedTab component**

Create `client/src/components/ProtectedTab.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { ProtectedSender } from '../types'

export default function ProtectedTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [list, setList] = useState<ProtectedSender[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.protectedList()
      setList(res.protected)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }, [onDisconnected])

  useEffect(() => { load() }, [load])

  const handleUnprotect = async (email: string) => {
    try {
      await api.unprotectSenders([email])
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (list === null && !error) return <div className="hint">Loading protected senders…</div>

  return (
    <div>
      {error && <div className="banner banner-error">{error}</div>}
      {list && list.length === 0 && (
        <div className="empty-state">
          <div className="empty-stamp" aria-hidden="true">🛡</div>
          <h2>No protected senders yet</h2>
          <p>Protect senders to exclude them from bulk unsubscribe and trash actions.
             Senders matching banks, utilities, and government agencies are auto-protected after each scan.</p>
        </div>
      )}
      {list && list.length > 0 && (
        <div className="table-card">
          <table className="sender-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Reason</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.email}>
                  <td><span className="sender-email" style={{ fontSize: '13px' }}>{p.email}</span></td>
                  <td>
                    {p.reason.startsWith('auto:') ? (
                      <span className="badge badge-blue">Auto</span>
                    ) : (
                      <span className="badge badge-gray">Manual</span>
                    )}
                  </td>
                  <td className="hint">
                    {new Date(p.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    <button className="btn btn-small btn-ghost" onClick={() => handleUnprotect(p.email)}>
                      Unprotect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update SendersTab with Protect/Unprotect buttons and protection warnings**

In `client/src/components/SendersTab.tsx`:

1. Import ProtectedTab and api methods for protection
2. Add state for `protectedSet`, `showProtected`, `protectionWarning`
3. Load protected list alongside senders
4. Add sub-tab toggle (All Senders / Protected)
5. Add Protect/Unprotect buttons to tray
6. Filter protected senders before trash/unsub and show warning

- [ ] **Step 5: Build to verify**

Run: `cd C:/Users/deepa/email-unsubscriber/client && npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ProtectedTab.tsx client/src/types.ts client/src/api.ts client/src/components/SendersTab.tsx
git commit -m "feat: add protect-list UI with protected tab, tray buttons, and protection warnings"
```

---

### Task 4: Quick-filter toolbar backend + frontend

**Files:**
- Modify: `server/src/services/inboxService.js` — add `filterMessages(query, max)` function
- Modify: `server/src/routes/inbox.js` — add `GET /api/inbox/filter` route
- Create: `client/src/components/FilterToolbar.tsx`
- Modify: `client/src/components/InboxTab.tsx` — mount toolbar, show filtered results
- Modify: `client/src/api.ts` — add `filterMessages()` method
- Modify: `client/src/types.ts` — add `Filter` interface
- Modify: `client/src/styles.css` — add toolbar styles

**Interfaces:**
- Consumes: `inboxService.filterMessages(query, max)`, existing `GroupMessage` type, existing `.message-list` CSS patterns
- Produces: `FilterToolbar` component, `GET /api/inbox/filter?q=...` endpoint

- [ ] **Step 1: Add backend filter endpoint**

Add to `server/src/services/inboxService.js`:

```javascript
/** Run an arbitrary Gmail query and return recent messages. */
export async function filterMessages(query, max = 25) {
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    const res = await limited(() =>
      gmail.users.messages.list({ userId: 'me', q: query, maxResults: max })
    )
    const ids = (res.data.messages || []).map((m) => m.id)
    if (ids.length === 0) return []
    const messages = await getMetadata(gmail, ids, {})
    return messages
      .sort((a, b) => b.internalDate - a.internalDate)
      .map((m) => ({
        id: m.id,
        from: m.headers['from'] || '',
        subject: m.headers['subject'] || '',
        date: m.internalDate,
      }))
  })
}
```

Add to `server/src/routes/inbox.js`:

```javascript
import { listGroups, groupMessages, listAllLabels, filterMessages } from '../services/inboxService.js'

router.get('/inbox/filter', async (req, res, next) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'q query parameter is required' })
    }
    const messages = await filterMessages(q)
    res.json(messages)
  } catch (err) { next(err) }
})
```

- [ ] **Step 2: Add Filter type and API method**

Add to `client/src/types.ts`:

```typescript
export interface Filter {
  key: string
  label: string
  query: string
  category: 'engagement' | 'cleanup' | 'category'
}
```

Add to `client/src/api.ts`:

```typescript
filterMessages: (q: string) => request<GroupMessage[]>(`/api/inbox/filter?q=${encodeURIComponent(q)}`),
```

- [ ] **Step 3: Create FilterToolbar component**

Create `client/src/components/FilterToolbar.tsx`:

```tsx
import type { Filter } from '../types'

const FILTERS: Filter[] = [
  { key: 'never-opened', label: 'Never opened', query: 'is:unread older_than:6m -in:trash -in:spam', category: 'engagement' },
  { key: 'low-engagement', label: 'Rarely read', query: 'is:unread older_than:3m -in:trash -in:spam', category: 'engagement' },
  { key: 'unread-marketing', label: 'Unread marketing', query: 'is:unread category:promotions -in:trash -in:spam', category: 'category' },
  { key: 'unread-social', label: 'Unread social', query: 'is:unread category:social -in:trash -in:spam', category: 'category' },
  { key: 'old-newsletters', label: 'Old newsletters', query: 'category:updates older_than:1y -in:trash -in:spam', category: 'category' },
  { key: 'old-attachments', label: 'Old with attachments', query: 'has:attachment older_than:1y -in:trash -in:spam', category: 'cleanup' },
  { key: 'large-emails', label: 'Large (>5 MB)', query: 'larger:5M -in:trash -in:spam', category: 'cleanup' },
  { key: 'stale-unread', label: 'Unread 6 mo+', query: 'is:unread older_than:6m -in:trash -in:spam', category: 'cleanup' },
  { key: 'old-promotions', label: 'Old promotions', query: 'category:promotions older_than:1y -in:trash -in:spam', category: 'cleanup' },
  { key: 'old-forums', label: 'Old forums', query: 'category:forums older_than:1y -in:trash -in:spam', category: 'category' },
]

export { FILTERS }

interface Props {
  activeKey: string | null
  onSelect: (filter: Filter | null) => void
}

export default function FilterToolbar({ activeKey, onSelect }: Props) {
  return (
    <div className="filter-toolbar">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`badge ${activeKey === f.key ? 'badge-active' : 'badge-gray'}`}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelect(activeKey === f.key ? null : f)}
        >
          {f.label}
        </button>
      ))}
      {activeKey && (
        <button className="btn btn-small btn-ghost" onClick={() => onSelect(null)}>
          Clear filter
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Integrate FilterToolbar into InboxTab**

Update `client/src/components/InboxTab.tsx` to import and render the toolbar above pigeonholes, show filtered results when a filter is active.

- [ ] **Step 5: Add CSS**

Add to `client/src/styles.css`:

```css
.filter-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-toolbar .badge {
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.filter-toolbar .badge:hover {
  background: var(--tint-blue);
  color: var(--airmail-blue);
}

.badge-active {
  background: var(--airmail-blue) !important;
  color: #fff !important;
}
```

- [ ] **Step 6: Build + test**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test && cd client && npm run build`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add server/src/services/inboxService.js server/src/routes/inbox.js client/src/components/FilterToolbar.tsx client/src/components/InboxTab.tsx client/src/api.ts client/src/types.ts client/src/styles.css
git commit -m "feat: add quick-filter toolbar with 10 pre-built Gmail query filters"
```

---

### Task 5: Storage recovery backend service + tests

**Files:**
- Create: `server/src/services/storageService.js`
- Create: `server/test/storageService.test.js`

**Interfaces:**
- Consumes: `gmail.users.messages.list`, `gmail.users.messages.get` (format: metadata), `limited()`, `withAuthErrorHandling`, `getMetadata`
- Produces: `getStorageStats()`, `getTopSenders(limit)`, `getTopMonths(limit)`, `getLargeAttachments(minSizeMB)` — used by Task 6 (routes)

- [ ] **Step 1: Write failing tests**

Create `server/test/storageService.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateBySender,
  aggregateByMonth,
  filterLargeAttachments,
  bytesToMB,
} from '../src/services/storageService.js'

describe('storageService aggregation', () => {
  const messages = [
    { id: '1', from: 'alice@example.com', sizeEstimate: 5_000_000, date: new Date('2024-01-15').getTime(), hasAttachment: true, subject: 'Report' },
    { id: '2', from: 'alice@example.com', sizeEstimate: 3_000_000, date: new Date('2024-01-20').getTime(), hasAttachment: false, subject: 'Update' },
    { id: '3', from: 'bob@other.com', sizeEstimate: 10_000_000, date: new Date('2024-03-05').getTime(), hasAttachment: true, subject: 'Big file' },
    { id: '4', from: 'alice@example.com', sizeEstimate: 1_000_000, date: new Date('2024-03-10').getTime(), hasAttachment: false, subject: 'Note' },
  ]

  it('aggregateBySender groups and sums correctly', () => {
    const result = aggregateBySender(messages, 10)
    assert.equal(result.length, 2)
    const alice = result.find(s => s.email === 'alice@example.com')
    assert.ok(alice)
    assert.equal(alice.messageCount, 3)
    assert.ok(Math.abs(alice.totalMB - bytesToMB(9_000_000)) < 0.01)
    // sorted by size desc
    assert.equal(result[0].email, 'bob@other.com')
  })

  it('aggregateByMonth groups and sums correctly', () => {
    const result = aggregateByMonth(messages, 12)
    assert.ok(result.length >= 2)
    const jan = result.find(m => m.month === '2024-01')
    assert.ok(jan)
    assert.equal(jan.messageCount, 2)
    assert.ok(Math.abs(jan.totalMB - bytesToMB(8_000_000)) < 0.01)
  })

  it('filterLargeAttachments returns only messages with attachments above threshold', () => {
    const result = filterLargeAttachments(messages, 4)
    assert.equal(result.length, 2)
    assert.ok(result.every(m => m.hasAttachment))
    assert.ok(result.every(m => bytesToMB(m.sizeEstimate) >= 4))
  })

  it('bytesToMB converts correctly', () => {
    assert.ok(Math.abs(bytesToMB(1_048_576) - 1) < 0.01)
    assert.equal(bytesToMB(0), 0)
  })

  it('aggregateBySender respects limit', () => {
    const result = aggregateBySender(messages, 1)
    assert.equal(result.length, 1)
  })

  it('aggregateByMonth sorts by month desc', () => {
    const result = aggregateByMonth(messages, 12)
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i - 1].month >= result[i].month)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test`
Expected: FAIL — module `storageService.js` does not exist

- [ ] **Step 3: Implement storageService.js**

Create `server/src/services/storageService.js`:

```javascript
import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { limited } from '../gmail/rateLimiter.js'

export function bytesToMB(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

export function aggregateBySender(messages, limit = 10) {
  const map = new Map()
  for (const m of messages) {
    const email = m.from.toLowerCase()
    let entry = map.get(email)
    if (!entry) {
      entry = { email, name: m.from, totalBytes: 0, messageCount: 0 }
      map.set(email, entry)
    }
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return [...map.values()]
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit)
    .map(e => ({ email: e.email, name: e.name, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }))
}

export function aggregateByMonth(messages, limit = 12) {
  const map = new Map()
  for (const m of messages) {
    const d = new Date(m.date)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let entry = map.get(month)
    if (!entry) {
      entry = { month, totalBytes: 0, messageCount: 0 }
      map.set(month, entry)
    }
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return [...map.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, limit)
    .map(e => ({ month: e.month, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }))
}

export function filterLargeAttachments(messages, minSizeMB = 5) {
  const minBytes = minSizeMB * 1024 * 1024
  return messages
    .filter(m => m.hasAttachment && m.sizeEstimate >= minBytes)
    .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
    .map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      sizeMB: bytesToMB(m.sizeEstimate),
      date: m.date,
    }))
}

// In-memory cache
let cache = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchLargeMessages(gmail, emit) {
  const messages = []
  let pageToken
  let listed = 0
  do {
    const res = await limited(() =>
      gmail.users.messages.list({
        userId: 'me',
        q: 'larger:1M -in:trash -in:spam',
        maxResults: 500,
        pageToken,
      })
    )
    const ids = (res.data.messages || []).map(m => m.id)
    if (ids.length === 0) break

    const batch = await Promise.all(
      ids.map(id =>
        limited(() =>
          gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject'],
          })
        ).then(r => {
          const headers = {}
          for (const h of r.data.payload?.headers || []) {
            headers[h.name.toLowerCase()] = h.value
          }
          return {
            id: r.data.id,
            from: headers['from'] || '',
            subject: headers['subject'] || '',
            sizeEstimate: r.data.sizeEstimate || 0,
            date: Number(r.data.internalDate || 0),
            hasAttachment: (r.data.labelIds || []).some(l => l === 'ATTACHMENT') ||
              (r.data.payload?.mimeType || '').includes('multipart'),
          }
        }).catch(() => null)
      )
    )

    messages.push(...batch.filter(Boolean))
    listed += ids.length
    pageToken = res.data.nextPageToken
    if (emit) emit({ phase: 'analyzing', processed: listed })
  } while (pageToken)

  return messages
}

export async function getStorageStats(emit) {
  return withAuthErrorHandling(async () => {
    const now = Date.now()
    if (cache && (now - cacheTime) < CACHE_TTL) return cache

    const gmail = await getGmail()
    const messages = await fetchLargeMessages(gmail, emit)

    const totalBytes = messages.reduce((sum, m) => sum + m.sizeEstimate, 0)
    const stats = {
      totalMB: bytesToMB(totalBytes),
      messageCount: messages.length,
      senders: aggregateBySender(messages, 10),
      months: aggregateByMonth(messages, 12),
      attachments: filterLargeAttachments(messages, 5),
    }
    cache = stats
    cacheTime = now
    return stats
  })
}

export function clearStorageCache() {
  cache = null
  cacheTime = 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test`
Expected: All storageService tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/storageService.js server/test/storageService.test.js
git commit -m "feat: add storageService with sender/month aggregation and large attachment filtering"
```

---

### Task 6: Storage recovery routes + tab

**Files:**
- Create: `server/src/routes/storage.js`
- Create: `client/src/components/StorageTab.tsx`
- Modify: `server/src/index.js`
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/styles.css`

**Interfaces:**
- Consumes: `storageService.getStorageStats()`, `storageService.clearStorageCache()`, existing `api.trashSenders()`, existing `.table-card` / `.tray` CSS
- Produces: `GET /api/storage/stats` endpoint, `StorageTab` component, new "Storage" tab in App

- [ ] **Step 1: Create storage routes**

Create `server/src/routes/storage.js`:

```javascript
import { Router } from 'express'
import { getStorageStats, clearStorageCache } from '../services/storageService.js'

const router = Router()

router.get('/storage/stats', async (req, res, next) => {
  try {
    const stats = await getStorageStats()
    res.json(stats)
  } catch (err) { next(err) }
})

router.post('/storage/refresh', async (req, res) => {
  clearStorageCache()
  res.json({ ok: true })
})

export default router
```

- [ ] **Step 2: Mount in index.js**

Add to `server/src/index.js`:

```javascript
import storageRoutes from './routes/storage.js'
```

```javascript
app.use('/api', storageRoutes)
```

- [ ] **Step 3: Add storage types**

Add to `client/src/types.ts`:

```typescript
export interface StorageStats {
  totalMB: number
  messageCount: number
  senders: StorageSender[]
  months: StorageMonth[]
  attachments: StorageAttachment[]
}

export interface StorageSender {
  email: string
  name: string
  totalMB: number
  messageCount: number
}

export interface StorageMonth {
  month: string
  totalMB: number
  messageCount: number
}

export interface StorageAttachment {
  id: string
  from: string
  subject: string
  sizeMB: number
  date: number
}
```

- [ ] **Step 4: Add API methods**

Add to `client/src/api.ts`:

```typescript
storageStats: () => request<StorageStats>('/api/storage/stats'),
storageRefresh: () => request<{ ok: boolean }>('/api/storage/refresh', { method: 'POST' }),
```

Import storage types at the top.

- [ ] **Step 5: Create StorageTab component**

Create `client/src/components/StorageTab.tsx` — dashboard with 4 cards (total storage, top senders bar chart, top months bar chart, large attachments table) + drill-down message list.

- [ ] **Step 6: Update App.tsx with Storage tab**

Add Storage tab button and render `StorageTab` component.

- [ ] **Step 7: Add storage CSS**

Add to `client/src/styles.css`:

```css
.storage-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px; }
.storage-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-card); }
.storage-card h3 { font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 0 0 12px; }
.storage-big-number { font-family: var(--font-mono); font-size: 48px; font-weight: 700; color: var(--ink); }
.storage-big-sub { font-size: 14px; color: var(--muted); margin-top: 4px; }
.storage-bar-chart { display: flex; flex-direction: column; gap: 10px; }
.storage-bar { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 4px 0; border-radius: 4px; transition: background 100ms; }
.storage-bar:hover { background: var(--tint-blue); }
.storage-bar-fill { height: 22px; background: var(--airmail-blue); border-radius: 4px; transition: width 200ms ease; min-width: 4px; }
.storage-bar-label { font-family: var(--font-mono); font-size: 12px; white-space: nowrap; min-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.storage-bar-value { font-family: var(--font-mono); font-size: 12px; color: var(--muted); white-space: nowrap; }
```

- [ ] **Step 8: Build + test**

Run: `cd C:/Users/deepa/email-unsubscriber && npm test && cd client && npm run build`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add server/src/routes/storage.js server/src/index.js client/src/components/StorageTab.tsx client/src/types.ts client/src/api.ts client/src/App.tsx client/src/styles.css
git commit -m "feat: add storage recovery dashboard with top senders/months and large attachments"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: None
- Produces: Updated README with new feature docs and E2E checklist items; updated ROADMAP with shipped features

- [ ] **Step 1: Update README**

Add sections for Protect-list, Quick-filter toolbar, and Storage tab to Usage. Add E2E checklist items for all three features.

- [ ] **Step 2: Update ROADMAP**

Move Protect-list and Sweeper tools from "Now" to "Shipped".

- [ ] **Step 3: Commit**

```bash
git add README.md ROADMAP.md
git commit -m "docs: update README and ROADMAP for protect-list, quick-filter, and storage features"
```
