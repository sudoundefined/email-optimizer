# "Now" Tier Quick Wins: Keep-Latest-N + Bulk-Trash Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two highest-ROI "Now" tier items from `ROADMAP.md`:
1. **Keep-latest-N** — per-sender retention ("keep the 3 newest emails from this sender, trash the rest").
2. **Bulk-trash from filters** — let the Inbox quick-filters trash the *entire* matching set, not just the 25 visible messages.

**Tech Stack:** Node.js ESM (server), React 18 + TypeScript + MUI v9 (client). No new dependencies. No database — Gmail is source of truth.

---

## Findings from code review (why this scope)

A review of the current codebase (2026-07-09) found the roadmap's "Bulk-trash from Storage/Filters" is **already ~80% shipped**:

- `POST /api/messages/trash` (`server/src/routes/messages.js`) is a universal "trash these IDs" primitive — inline for ≤200 IDs, background job for more, 10k safety cap.
- `StorageTab.tsx` and `InboxTab.tsx` both have the full selection tray → `ConfirmDialog` → `api.trashMessages()` → job-progress flow working today. Storage drill-down trash is **done**.

**The one real gap for filters:** `inboxService.filterMessages(query, max=25)` only returns the 25 most-recent messages, and the tray can only trash what's on screen. A user filtering "Old promotions (>1y)" with 4,000 matches can currently trash 25 at a time. True bulk-trash means "trash all 4,000 matching this query."

**Keep-latest-N** is genuinely not built at all.

So this plan = **Feature A (Keep-latest-N, net new)** + **Feature B (trash-all-matching-query, closes the filter gap)**.

---

## Global Constraints

- **Gmail trash only** — never permanent delete; always `addLabelIds: ['TRASH'], removeLabelIds: ['INBOX']`. Reuse existing `trashService`/`messageTrashService` batching (1000 IDs/call).
- All Gmail API calls go through `limited()` (`gmail/rateLimiter.js`) + `withAuthErrorHandling` (`auth/oauthClient.js`).
- **Protect-list is respected**: Keep-latest-N must refuse to trash a protected sender (reuse `protectService.isProtected`). Trash-all-query does not touch protect-list (it's message-scoped, not sender-scoped) but must exclude `-in:trash -in:spam`.
- Long operations run as background jobs via `createJob` so the client streams SSE progress through the existing `useJob` hook.
- TypeScript must compile clean (`npm run build -w client`) and all 55 server tests must pass after every task.
- MUI v9: layout via `sx={}`, `aria-label` on interactive controls, icon imports from `@mui/icons-material`.
- Commit after every task, prefix `feat:`, footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

# FEATURE A — Keep-Latest-N (per-sender retention)

**Design:** A new `retentionService.runKeepLatest({ senderEmail, keep }, emit)` queries Gmail for `from:<email> -in:trash -in:spam`. Gmail returns message IDs newest-first, so we page the full list, skip the first `keep` IDs, and trash the remainder. **No metadata fetch needed** — we rely on Gmail's reverse-chronological list order, making this cheap even for senders with thousands of messages. Protected senders are rejected before any trash call.

---

## Task A1: retentionService + tests

**Files:**
- Create: `server/src/services/retentionService.js`
- Create: `server/src/services/retentionService.test.js`

**Interfaces:**
- Consumes: `gmail/client.js#getGmail`, `gmail/messages.js#listAllMessageIds`, `messageTrashService.js#trashMessages`, `protectService.js#isProtected`, `rateLimiter.js#limited`
- Produces: `listKeepCandidates(senderEmail, keep)` (pure-ish, returns `{ total, toTrash: string[] }`), `runKeepLatest({ senderEmail, keep }, emit)` (job runner)

- [ ] **Step 1: Write the failing test**

Create `server/src/services/retentionService.test.js`. Test the pure ID-partitioning logic by extracting a helper `partitionKeepLatest(ids, keep)` that takes newest-first IDs and returns `{ keep: string[], toTrash: string[] }`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { partitionKeepLatest } from './retentionService.js'

describe('retentionService partitionKeepLatest', () => {
  const ids = ['n1', 'n2', 'n3', 'n4', 'n5'] // newest-first

  it('keeps the N newest and trashes the rest', () => {
    const r = partitionKeepLatest(ids, 3)
    assert.deepEqual(r.keep, ['n1', 'n2', 'n3'])
    assert.deepEqual(r.toTrash, ['n4', 'n5'])
  })

  it('trashes nothing when keep >= total', () => {
    const r = partitionKeepLatest(ids, 10)
    assert.deepEqual(r.toTrash, [])
    assert.equal(r.keep.length, 5)
  })

  it('keep=0 trashes everything', () => {
    const r = partitionKeepLatest(ids, 0)
    assert.deepEqual(r.toTrash, ids)
    assert.deepEqual(r.keep, [])
  })

  it('handles empty input', () => {
    const r = partitionKeepLatest([], 3)
    assert.deepEqual(r.toTrash, [])
    assert.deepEqual(r.keep, [])
  })
})
```

Run `npm test` → expect FAIL (module missing).

- [ ] **Step 2: Implement retentionService.js**

```javascript
import { getGmail } from '../gmail/client.js'
import { withAuthErrorHandling } from '../auth/oauthClient.js'
import { listAllMessageIds } from '../gmail/messages.js'
import { trashMessages } from './messageTrashService.js'
import { isProtected } from './protectService.js'

/**
 * Partition newest-first message IDs into keep/trash sets.
 * Gmail's messages.list returns most-recent first, so the first `keep`
 * IDs are the ones to retain.
 */
export function partitionKeepLatest(newestFirstIds, keep) {
  const n = Math.max(0, Math.floor(keep))
  return {
    keep: newestFirstIds.slice(0, n),
    toTrash: newestFirstIds.slice(n),
  }
}

/**
 * Job runner: keep the `keep` newest emails from one sender, trash the rest.
 * Refuses protected senders. Never permanent-deletes.
 */
export async function runKeepLatest({ senderEmail, keep }, emit) {
  return withAuthErrorHandling(async () => {
    const email = String(senderEmail).toLowerCase()
    if (await isProtected(email)) {
      return { protected: true, senderEmail: email, trashed: 0, kept: 0 }
    }

    const gmail = await getGmail()
    emit?.({ phase: 'listing', listed: 0 })
    // Gmail returns newest-first; cap high so we get the sender's full history.
    const ids = await listAllMessageIds(
      gmail,
      `from:${email} -in:trash -in:spam`,
      { maxMessages: 10_000, onProgress: (p) => emit?.({ phase: 'listing', ...p }) }
    )

    const { keep: kept, toTrash } = partitionKeepLatest(ids, keep)
    if (toTrash.length === 0) {
      return { protected: false, senderEmail: email, trashed: 0, kept: kept.length }
    }

    emit?.({ phase: 'trashing', trashed: 0, total: toTrash.length })
    const res = await trashMessages(toTrash, emit)
    return { protected: false, senderEmail: email, trashed: res.trashed, kept: kept.length }
  })
}
```

> **Note on `listAllMessageIds`:** it dedupes into a `Set` and returns insertion order, which preserves Gmail's newest-first paging order. Verify this holds — if a future change sorts the set, `partitionKeepLatest` would keep the wrong IDs. The test above guards the partition logic; the list-order assumption is documented here.

Run `npm test` → expect PASS (55 + 4 = 59).

- [ ] **Step 3: Commit**

```bash
git add server/src/services/retentionService.js server/src/services/retentionService.test.js
git commit -m "feat: add retentionService for keep-latest-N per sender

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task A2: Keep-latest route

**Files:**
- Modify: `server/src/routes/scan.js` (senders live here; keep-latest is a sender action)

**Interfaces:**
- Consumes: `retentionService.runKeepLatest`, `jobManager.createJob`
- Produces: `POST /api/senders/keep-latest` → `{ jobId }` or `{ jobId: null, protected: true }`

- [ ] **Step 1: Add the route**

In `server/src/routes/scan.js`, import and add after the `/senders/trash` handler:

```javascript
import { runKeepLatest } from '../services/retentionService.js'
import { isProtected } from '../services/protectService.js'

router.post('/senders/keep-latest', async (req, res, next) => {
  try {
    const { senderEmail, keep } = req.body || {}
    if (!senderEmail || typeof senderEmail !== 'string') {
      return res.status(400).json({ error: 'senderEmail is required' })
    }
    const n = Number(keep)
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return res.status(400).json({ error: 'keep must be an integer between 0 and 1000' })
    }
    if (await isProtected(senderEmail.toLowerCase())) {
      return res.json({ jobId: null, protected: true })
    }
    const job = createJob('keep-latest', (emit) => runKeepLatest({ senderEmail, keep: n }, emit))
    res.json({ jobId: job.id, protected: false })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Verify + commit**

```bash
npm test   # still 59 passing (route is integration-level)
git add server/src/routes/scan.js
git commit -m "feat: add POST /api/senders/keep-latest route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task A3: Keep-latest frontend (SendersTab tray)

**Files:**
- Modify: `client/src/api.ts`
- Modify: `client/src/components/SendersTab.tsx`

**Interfaces:**
- Consumes: new `api.keepLatest(senderEmail, keep)`, existing `useJob`, existing `ConfirmDialog`
- Produces: a "Keep latest…" tray button, enabled only when **exactly one** non-protected sender is selected (retention is inherently per-sender)

- [ ] **Step 1: Add API method**

In `client/src/api.ts`, after `trashSenders`:

```typescript
keepLatest: (senderEmail: string, keep: number) =>
  request<{ jobId: string | null; protected: boolean }>('/api/senders/keep-latest', {
    method: 'POST',
    body: JSON.stringify({ senderEmail, keep }),
  }),
```

- [ ] **Step 2: Add state + handler in SendersTab.tsx**

Add near the other job hooks/state:

```typescript
const keepJob = useJob()
const [showKeepDialog, setShowKeepDialog] = useState(false)
const [keepN, setKeepN] = useState(3)
const [keepDone, setKeepDone] = useState<string | null>(null)
```

Add the handler (single-sender guard):

```typescript
const runKeepLatest = async () => {
  setShowKeepDialog(false)
  setError(null)
  setKeepDone(null)
  const target = selectedSenders.find((s) => !protectedSet.has(s.email.toLowerCase()))
  if (!target) return
  try {
    const response = await api.keepLatest(target.email, keepN)
    if (response.protected || !response.jobId) {
      setProtectionWarning('That sender is protected and was skipped.')
      return
    }
    const snapshot = await keepJob.start(() => Promise.resolve({ jobId: response.jobId! }))
    if (snapshot.state === 'error') {
      setError(snapshot.error || 'Keep-latest failed')
    } else {
      const r = snapshot.result as { trashed: number; kept: number }
      setKeepDone(
        `Kept the ${r.kept} newest emails from ${target.name || target.email} and moved ${r.trashed.toLocaleString()} older ones to Trash (recoverable 30 days).`
      )
      setSelected(new Set())
      await loadSenders()
    }
  } catch (err) {
    handleApiError(err)
  }
}
```

- [ ] **Step 3: Render the tray button + success banner**

Add `{keepDone && <Alert severity="success" sx={{ mb: 2 }}>{keepDone}</Alert>}` alongside the other banners.

In the tray's action `Stack`, add a button shown only when exactly one non-protected sender is selected:

```tsx
{selectedNonProtectedCount === 1 && (
  <Button
    variant="contained"
    size="small"
    color="inherit"
    sx={{ bgcolor: 'grey.700', '&:hover': { bgcolor: 'grey.600' } }}
    disabled={unsubJob.running || trashJob.running || keepJob.running}
    onClick={() => setShowKeepDialog(true)}
  >
    Keep latest…
  </Button>
)}
```

- [ ] **Step 4: Render the keep-N dialog**

Reuse the MUI primitives already imported. Add a small dialog (a lightweight inline `Dialog` with a number `TextField`, or extend `ConfirmDialog` — prefer a dedicated inline dialog to keep `ConfirmDialog` generic):

```tsx
{showKeepDialog && (
  <Dialog open onClose={() => setShowKeepDialog(false)} maxWidth="xs" fullWidth>
    <DialogTitle>Keep latest emails</DialogTitle>
    <DialogContent>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Keep the newest emails from{' '}
        <strong>{selectedSenders.find((s) => !protectedSet.has(s.email.toLowerCase()))?.name}</strong>{' '}
        and move all older ones to Trash (recoverable for 30 days).
      </Typography>
      <TextField
        type="number"
        size="small"
        label="Emails to keep"
        value={keepN}
        onChange={(e) => setKeepN(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
        inputProps={{ min: 0, max: 1000 }}
        autoFocus
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setShowKeepDialog(false)}>Cancel</Button>
      <Button variant="contained" color="error" onClick={runKeepLatest}>
        Keep {keepN}, trash the rest
      </Button>
    </DialogActions>
  </Dialog>
)}
```

Add the MUI dialog imports (`Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `TextField`) to the import block.

- [ ] **Step 5: Build + commit**

```bash
npm run build -w client   # clean
git add client/src/api.ts client/src/components/SendersTab.tsx
git commit -m "feat: add Keep-latest-N control to Senders tray (single-sender retention)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# FEATURE B — Trash-all-matching-query (closes the filter bulk-trash gap)

**Design:** A new endpoint trashes every message matching a filter's Gmail query (not just the 25 shown). It reuses `listAllMessageIds` to page the full result set, then `trashMessages` to batch-trash. Runs as a job. The Inbox filter view gains a **"Trash all N matching"** action distinct from the per-message tray. To prevent accidents, the query is **allow-listed** to the known `FILTERS` set — the client sends a filter `key`, not a raw query, so arbitrary user queries can't be injected.

---

## Task B1: filter-trash service function + route (allow-listed)

**Files:**
- Modify: `server/src/services/inboxService.js` (add `FILTERS` map + `trashByFilterKey`)
- Modify: `server/src/routes/inbox.js`

**Interfaces:**
- Consumes: `listAllMessageIds`, `messageTrashService.trashMessages`
- Produces: `POST /api/inbox/filter/:key/trash` → `{ jobId }`

- [ ] **Step 1: Move the filter definitions server-side (single source of truth)**

The 10 filters currently live only in `client/src/components/FilterToolbar.tsx`. To allow-list them on the server, add a `FILTERS` map to `server/src/services/inboxService.js`:

```javascript
// Keep in sync with client/src/components/FilterToolbar.tsx FILTERS.
export const FILTERS = {
  'never-opened':     'is:unread older_than:6m -in:trash -in:spam',
  'low-engagement':   'is:unread older_than:3m -in:trash -in:spam',
  'unread-marketing': 'is:unread category:promotions -in:trash -in:spam',
  'unread-social':    'is:unread category:social -in:trash -in:spam',
  'old-newsletters':  'category:updates older_than:1y -in:trash -in:spam',
  'old-attachments':  'has:attachment older_than:1y -in:trash -in:spam',
  'large-emails':     'larger:5M -in:trash -in:spam',
  'stale-unread':     'is:unread older_than:6m -in:trash -in:spam',
  'old-promotions':   'category:promotions older_than:1y -in:trash -in:spam',
  'old-forums':       'category:forums older_than:1y -in:trash -in:spam',
}

export async function trashByFilterKey(key, emit) {
  const q = FILTERS[key]
  if (!q) {
    const err = new Error(`Unknown filter "${key}"`)
    err.status = 400
    throw err
  }
  return withAuthErrorHandling(async () => {
    const gmail = await getGmail()
    emit?.({ phase: 'listing', listed: 0 })
    const ids = await listAllMessageIds(gmail, q, {
      maxMessages: 10_000,
      onProgress: (p) => emit?.({ phase: 'listing', ...p }),
    })
    if (ids.length === 0) return { trashed: 0 }
    return trashMessages(ids, emit)
  })
}
```

Add imports at the top of `inboxService.js`: `listAllMessageIds` (already imports `getMetadata` from `gmail/messages.js` — add to that import) and `trashMessages` from `../services/messageTrashService.js`.

- [ ] **Step 2: Add the route**

In `server/src/routes/inbox.js`:

```javascript
import { listGroups, groupMessages, listAllLabels, filterMessages, trashByFilterKey } from '../services/inboxService.js'
import { createJob } from '../jobs/jobManager.js'

router.post('/inbox/filter/:key/trash', async (req, res, next) => {
  try {
    const job = createJob('filter-trash', (emit) => trashByFilterKey(req.params.key, emit))
    res.json({ jobId: job.id })
  } catch (err) { next(err) }
})
```

(Unknown-key validation happens inside `trashByFilterKey`, surfaced as a 400 by the job — or validate `FILTERS[key]` in the route before `createJob` for a synchronous 400. Prefer the latter for a clean error.)

- [ ] **Step 3: Optional test**

Add a test asserting `trashByFilterKey('bogus')` rejects and that `FILTERS` covers all 10 client keys (guards drift). Run `npm test`.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/inboxService.js server/src/routes/inbox.js
git commit -m "feat: add allow-listed trash-all-matching endpoint for inbox filters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task B2: "Trash all N matching" action in InboxTab

**Files:**
- Modify: `client/src/api.ts`
- Modify: `client/src/components/FilterToolbar.tsx` (export the filter `key` — already present)
- Modify: `client/src/components/InboxTab.tsx`

**Interfaces:**
- Consumes: new `api.trashFilter(key)`, active filter's `key` + the group count estimate
- Produces: a "Trash all matching" button in the filter results header, guarded by `ConfirmDialog` with typed-count for large sets

- [ ] **Step 1: Add API method**

```typescript
trashFilter: (key: string) =>
  request<{ jobId: string }>(`/api/inbox/filter/${encodeURIComponent(key)}/trash`, { method: 'POST' }),
```

- [ ] **Step 2: Add handler + confirm dialog in InboxTab**

Add a `filterTrashJob = useJob()`, a `confirmFilterTrash` boolean, and:

```typescript
const runFilterTrash = async () => {
  if (!activeFilter) return
  setConfirmFilterTrash(false)
  setError(null)
  try {
    const snapshot = await filterTrashJob.start(() => api.trashFilter(activeFilter.key))
    if (snapshot.state === 'error') {
      setError(snapshot.error || 'Trash failed')
      return
    }
    const r = snapshot.result as { trashed: number }
    setTrashDone(`Moved ${r.trashed.toLocaleString()} messages matching "${activeFilter.label}" to Trash. Recoverable for 30 days.`)
    setFilterResults([])       // clear the visible sample
    setSelected(new Set())
  } catch (err) {
    handleApiError(err)
  }
}
```

- [ ] **Step 3: Render the button**

In the filter results header (the `Box` showing `activeFilter.label`), add — only when a filter is active:

```tsx
{activeFilter && (
  <Button
    size="small"
    variant="outlined"
    color="error"
    disabled={filterTrashJob.running}
    onClick={() => setConfirmFilterTrash(true)}
  >
    {filterTrashJob.running ? 'Trashing…' : 'Trash all matching'}
  </Button>
)}
```

And the dialog (typed confirmation is important — this trashes an unbounded set the user hasn't individually reviewed):

```tsx
{confirmFilterTrash && activeFilter && (
  <ConfirmDialog
    title={`Trash all messages matching "${activeFilter.label}"?`}
    message="This moves EVERY message matching this filter to Gmail Trash — not just the ones shown here. Recoverable for 30 days. This does not unsubscribe you."
    danger
    onCancel={() => setConfirmFilterTrash(false)}
    onConfirm={runFilterTrash}
  />
)}
```

> **UX note:** the visible list is only a 25-message sample, so the dialog copy must make clear the action affects the *entire* matching set. Consider showing the group-count estimate ("≈4,000") if you wire the filter to `resultSizeEstimate`; otherwise the honest "EVERY message matching" copy is sufficient for v1.

- [ ] **Step 4: Build + commit**

```bash
npm run build -w client
git add client/src/api.ts client/src/components/InboxTab.tsx
git commit -m "feat: add 'Trash all matching' action to inbox filters (full result set)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task C: Docs + final verification

**Files:**
- Modify: `README.md`, `ROADMAP.md`, `VERIFICATION_REPORT.md`

- [ ] **Step 1: README** — under the Senders tab, document "Keep latest N"; under the Inbox tab, document "Trash all matching."
- [ ] **Step 2: ROADMAP** — move **Keep latest N** and **Bulk-trash from Storage/Filters** from "Now" to "✅ Shipped."
- [ ] **Step 3: VERIFICATION_REPORT** — flip the two "Now" tier ❌ rows to ✅.
- [ ] **Step 4: Full gate**

```bash
npm test                 # expect all green (59+)
npm run build -w client  # clean TS build
```

- [ ] **Step 5: Manual smoke test**
  1. Scan → select one sender → "Keep latest…" → set 3 → confirm → verify N kept, rest trashed, count refreshes.
  2. Select a protected sender → "Keep latest…" hidden / rejected with warning.
  3. Inbox → apply "Old promotions" filter → "Trash all matching" → confirm → success banner with real trashed count.
  4. Verify trashed mail is in Gmail Trash (recoverable), not gone.

- [ ] **Step 6: Commit**

```bash
git add README.md ROADMAP.md VERIFICATION_REPORT.md
git commit -m "docs: mark Keep-latest-N and bulk-trash-from-filters as shipped

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Edge cases & risks

- **List order assumption (Feature A):** Keep-latest relies on Gmail returning `messages.list` newest-first and `listAllMessageIds` preserving that order. It does today (Set insertion order over sequential pages). If someone later sorts inside `listAllMessageIds`, retention silently keeps the wrong messages. Mitigation: the partition unit test + the documented note; optionally add an integration guard that fetches `internalDate` for the boundary IDs.
- **Protected-sender safety (Feature A):** checked both in the route (fast reject) and inside `runKeepLatest` (defense in depth). Keep both.
- **Unbounded trash (Feature B):** `maxMessages: 10_000` caps a single run. For filters matching >10k, the job trashes the first 10k; the user re-runs. `log`/surface this rather than silently capping — add a `capped: true` flag to the result when `ids.length === 10_000` and note it in the success banner.
- **Filter drift (Feature B):** the server `FILTERS` map duplicates the client list. The optional Task B1 test asserting key-parity prevents them diverging. If you'd rather not duplicate, a follow-up could serve `FILTERS` from the server and have the toolbar fetch it — out of scope here.
- **Not permanent delete:** every path uses `addLabelIds: ['TRASH']`. No `messages.delete` anywhere. Preserve this invariant.

---

## Out of scope (deliberately deferred)

- Scheduled re-scan / weekly digest email — blocked on production OAuth (7-day token expiry makes cron unreliable). Separate plan.
- Retention *rules* (auto keep-N on every scan) — belongs in the "Next" tier auto-rules engine.
- Serving `FILTERS` from server to client as one source of truth — nice-to-have refactor, not required for these features.
</content>
</invoke>
