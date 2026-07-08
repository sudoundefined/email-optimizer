# Storage Size Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add size-bracket filtering to the Storage tab so users can isolate emails by size band (e.g. <500 KB, 500 KB–1 MB, 1–5 MB, 5–10 MB, 10–25 MB, >25 MB) and selectively trash them.

**Architecture:** A new `aggregateBySizeBand()` function groups the warm in-memory cache into predefined bands. The existing `getDrillDownMessages()` function gains a `by='size'` branch that matches messages whose `sizeEstimate` falls within the requested band. The client renders a new "Storage by size" card with clickable band rows that open the existing `DrillPanel`, identical to the sender/month/year pattern.

**Tech Stack:** Node.js ESM (server), React 18 + TypeScript + MUI v6 (client). No new dependencies.

## Global Constraints

- Gmail trash only — never permanent delete; always `addLabelIds: ['TRASH']`
- All size arithmetic in bytes on the server; MB rounded to 2 decimal places via the existing `bytesToMB()` helper
- `getDrillDownMessages` must stay O(n) in-memory; no additional Gmail API calls
- TypeScript must compile clean (`tsc -b`) and all 52 server tests must pass after every task
- MUI v6: all layout props go through `sx={}`, `aria-label` directly on `<Checkbox>`, barrel icon imports from `@mui/icons-material`
- Commit after every task with prefix `feat:` and co-author `Co-Authored-By: Claude <noreply@anthropic.com>`

---

## Size bands (exact boundaries)

| Band key | Label | Min bytes (inclusive) | Max bytes (exclusive) |
|---|---|---|---|
| `lt500k` | < 500 KB | 0 | 512 000 |
| `500k-1m` | 500 KB – 1 MB | 512 000 | 1 048 576 |
| `1m-5m` | 1 – 5 MB | 1 048 576 | 5 242 880 |
| `5m-10m` | 5 – 10 MB | 5 242 880 | 10 485 760 |
| `10m-25m` | 10 – 25 MB | 10 485 760 | 26 214 400 |
| `gt25m` | > 25 MB | 26 214 400 | Infinity |

These constants live in a single exported array `SIZE_BANDS` so both the aggregator and the drill-down filter use the same boundaries.

---

## Task 1: Add SIZE_BANDS constant + aggregateBySizeBand() to storageService.js

**Files:**
- Modify: `server/src/services/storageService.js`

**Interfaces:**
- Produces:
  - `SIZE_BANDS: Array<{ key: string, label: string, minBytes: number, maxBytes: number }>`
  - `aggregateBySizeBand(messages): Array<{ key: string, label: string, totalMB: number, messageCount: number }>`

- [ ] **Step 1: Add SIZE_BANDS constant**

Insert after the existing `bytesToMB` function (line ~7):

```js
export const SIZE_BANDS = [
  { key: 'lt500k',   label: '< 500 KB',      minBytes: 0,          maxBytes: 512_000 },
  { key: '500k-1m',  label: '500 KB – 1 MB', minBytes: 512_000,    maxBytes: 1_048_576 },
  { key: '1m-5m',    label: '1 – 5 MB',      minBytes: 1_048_576,  maxBytes: 5_242_880 },
  { key: '5m-10m',   label: '5 – 10 MB',     minBytes: 5_242_880,  maxBytes: 10_485_760 },
  { key: '10m-25m',  label: '10 – 25 MB',    minBytes: 10_485_760, maxBytes: 26_214_400 },
  { key: 'gt25m',    label: '> 25 MB',        minBytes: 26_214_400, maxBytes: Infinity },
]
```

- [ ] **Step 2: Add aggregateBySizeBand() after aggregateByYear()**

```js
export function aggregateBySizeBand(messages) {
  const counts = new Map(SIZE_BANDS.map(b => [b.key, { totalBytes: 0, messageCount: 0 }]))
  for (const m of messages) {
    const band = SIZE_BANDS.find(b => m.sizeEstimate >= b.minBytes && m.sizeEstimate < b.maxBytes)
    if (!band) continue
    const entry = counts.get(band.key)
    entry.totalBytes += m.sizeEstimate
    entry.messageCount++
  }
  return SIZE_BANDS.map(b => {
    const e = counts.get(b.key)
    return { key: b.key, label: b.label, totalMB: bytesToMB(e.totalBytes), messageCount: e.messageCount }
  })
}
```

- [ ] **Step 3: Add `sizes` to the stats object in getStorageStats()**

```js
const stats = {
  totalMB: bytesToMB(totalBytes),
  messageCount: messages.length,
  senders: aggregateBySender(messages, 10),
  months: aggregateByMonth(messages, 12),
  years: aggregateByYear(messages),
  sizes: aggregateBySizeBand(messages),   // ← add this line
  attachments: filterLargeAttachments(messages, 5),
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: `pass 52` (no new tests yet — aggregation tests come in Task 2).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/storageService.js
git commit -m "feat: add SIZE_BANDS constant and aggregateBySizeBand() to storageService

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add aggregateBySizeBand tests to storageService test file

**Files:**
- Modify: `server/src/services/storageService.test.js` (or whichever file contains the `storageService aggregation` suite — check `server/src/services/`)

**Interfaces:**
- Consumes: `SIZE_BANDS`, `aggregateBySizeBand` from `../services/storageService.js`

- [ ] **Step 1: Locate the existing test file**

```bash
grep -r "aggregateByMonth" server/src --include="*.test.js" -l
```

Expected output: one file path, e.g. `server/src/services/storageService.test.js`.

- [ ] **Step 2: Add three tests inside the existing `storageService aggregation` describe block**

```js
import { aggregateBySizeBand, SIZE_BANDS } from './storageService.js'

// inside the existing suite:

it('aggregateBySizeBand places messages in correct bands', () => {
  const messages = [
    { sizeEstimate: 400_000,    from: 'a@a.com', hasAttachment: false, date: 0, id: '1', subject: '' },
    { sizeEstimate: 600_000,    from: 'b@b.com', hasAttachment: false, date: 0, id: '2', subject: '' },
    { sizeEstimate: 3_000_000,  from: 'c@c.com', hasAttachment: false, date: 0, id: '3', subject: '' },
    { sizeEstimate: 7_000_000,  from: 'd@d.com', hasAttachment: false, date: 0, id: '4', subject: '' },
    { sizeEstimate: 15_000_000, from: 'e@e.com', hasAttachment: false, date: 0, id: '5', subject: '' },
    { sizeEstimate: 30_000_000, from: 'f@f.com', hasAttachment: false, date: 0, id: '6', subject: '' },
  ]
  const result = aggregateBySizeBand(messages)
  assert.strictEqual(result.find(r => r.key === 'lt500k').messageCount,  1)
  assert.strictEqual(result.find(r => r.key === '500k-1m').messageCount, 1)
  assert.strictEqual(result.find(r => r.key === '1m-5m').messageCount,   1)
  assert.strictEqual(result.find(r => r.key === '5m-10m').messageCount,  1)
  assert.strictEqual(result.find(r => r.key === '10m-25m').messageCount, 1)
  assert.strictEqual(result.find(r => r.key === 'gt25m').messageCount,   1)
})

it('aggregateBySizeBand returns all bands even if empty', () => {
  const result = aggregateBySizeBand([])
  assert.strictEqual(result.length, SIZE_BANDS.length)
  assert.ok(result.every(r => r.messageCount === 0 && r.totalMB === 0))
})

it('aggregateBySizeBand preserves SIZE_BANDS order in output', () => {
  const result = aggregateBySizeBand([])
  const keys = result.map(r => r.key)
  assert.deepStrictEqual(keys, SIZE_BANDS.map(b => b.key))
})
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: `pass 55` (3 new tests added).

- [ ] **Step 4: Commit**

```bash
git add server/src/services/storageService.test.js
git commit -m "feat: add aggregateBySizeBand unit tests (55 passing)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add by='size' branch to getDrillDownMessages() + update route validation

**Files:**
- Modify: `server/src/services/storageService.js`
- Modify: `server/src/routes/storage.js`

**Interfaces:**
- Consumes: `SIZE_BANDS` (already exported from storageService.js)
- Produces: `getDrillDownMessages('size', 'gt25m')` returns `StorageDrillMessage[]` sorted by `sizeEstimate` desc

- [ ] **Step 1: Add 'size' branch inside getDrillDownMessages()**

Add after the `by === 'year'` block, before `return []`:

```js
if (by === 'size') {
  const band = SIZE_BANDS.find(b => b.key === value)
  if (!band) return []
  return messages
    .filter(m => m.sizeEstimate >= band.minBytes && m.sizeEstimate < band.maxBytes)
    .sort((a, b) => b.sizeEstimate - a.sizeEstimate)
    .map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      sizeMB: bytesToMB(m.sizeEstimate),
      date: m.date,
      hasAttachment: m.hasAttachment,
    }))
}
```

- [ ] **Step 2: Update route validation in storage.js**

```js
// Before:
if (!by || !value || !['sender', 'month', 'year'].includes(by)) {
  return res.status(400).json({ error: 'by must be "sender", "month", or "year", value is required' })
}

// After:
if (!by || !value || !['sender', 'month', 'year', 'size'].includes(by)) {
  return res.status(400).json({ error: 'by must be "sender", "month", "year", or "size", value is required' })
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: `pass 55` (no new tests — drill-down is integration-level, covered by the route returning correct data).

- [ ] **Step 4: Commit**

```bash
git add server/src/services/storageService.js server/src/routes/storage.js
git commit -m "feat: getDrillDownMessages supports by='size' + route allows size band drill-down

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update client types + api

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`

**Interfaces:**
- Produces:
  - `StorageSizeBand { key: string; label: string; totalMB: number; messageCount: number }`
  - `StorageStats.sizes: StorageSizeBand[]`
  - `api.storageDrillDown(by: 'sender' | 'month' | 'year' | 'size', value: string)`

- [ ] **Step 1: Add StorageSizeBand interface to types.ts**

Add after `StorageYear` (around line 120):

```typescript
export interface StorageSizeBand {
  key: string
  label: string
  totalMB: number
  messageCount: number
}
```

- [ ] **Step 2: Add sizes to StorageStats in types.ts**

```typescript
export interface StorageStats {
  totalMB: number
  messageCount: number
  senders: StorageSender[]
  months: StorageMonth[]
  years: StorageYear[]
  sizes: StorageSizeBand[]        // ← add
  attachments: StorageAttachment[]
}
```

- [ ] **Step 3: Update storageDrillDown signature in api.ts**

```typescript
storageDrillDown: (by: 'sender' | 'month' | 'year' | 'size', value: string) =>
  request<StorageDrillMessage[]>(
    `/api/storage/messages?by=${encodeURIComponent(by)}&value=${encodeURIComponent(value)}`
  ),
```

- [ ] **Step 4: Run TypeScript build**

```bash
npm run build -w client
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/types.ts client/src/api.ts
git commit -m "feat: add StorageSizeBand type and sizes field to StorageStats

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Add "Storage by size" card to StorageTab.tsx

**Files:**
- Modify: `client/src/components/StorageTab.tsx`

**Interfaces:**
- Consumes: `StorageSizeBand` from `../types`, `stats.sizes`, `api.storageDrillDown('size', band.key)`
- Produces: Clickable size-band bar rows → DrillPanel opens below the cards

- [ ] **Step 1: Import StorageSizeBand**

```typescript
import type { StorageAttachment, StorageDrillMessage, StorageStats, StorageYear, StorageSizeBand } from '../types'
```

- [ ] **Step 2: Extend DrillKey type**

```typescript
type DrillKey =
  | { by: 'sender'; value: string }
  | { by: 'month';  value: string }
  | { by: 'year';   value: string }
  | { by: 'size';   value: string }
  | null
```

- [ ] **Step 3: Update openDrill signature**

```typescript
const openDrill = async (by: 'sender' | 'month' | 'year' | 'size', value: string) => {
```

- [ ] **Step 4: Update drillTitle to handle size case**

```typescript
const drillTitle =
  drillKey?.by === 'sender'
    ? `Emails from ${parseFromHeader(
        stats.senders.find((s) => s.email === drillKey.value)?.name ?? drillKey.value
      )}`
    : drillKey?.by === 'month'
    ? `Emails from ${drillKey.value}`
    : drillKey?.by === 'year'
    ? `Emails from ${drillKey.value}`
    : drillKey?.by === 'size'
    ? `Emails sized ${(stats.sizes ?? []).find(s => s.key === drillKey.value)?.label ?? drillKey.value}`
    : ''
```

- [ ] **Step 5: Compute maxSizeMB for bar scaling**

Add alongside the existing `maxSenderMB` / `maxMonthMB` / `maxYearMB` lines:

```typescript
const maxSizeMB = Math.max(1, ...(stats.sizes ?? []).map((s) => s.totalMB))
```

- [ ] **Step 6: Add the "Storage by size" Grid card**

Add a new `<Grid size={{ xs: 12, md: 4 }}>` card after the "Storage by year" card (before `</Grid>` of the container). Use the same clickable-bar pattern:

```tsx
{/* Storage by size band */}
<Grid size={{ xs: 12, md: 4 }}>
  <Card>
    <CardContent>
      <Typography variant="overline" color="text.secondary">Storage by size</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Click a band to browse its messages
      </Typography>
      {(stats.sizes ?? []).every(s => s.messageCount === 0) && (
        <Typography variant="body2" color="text.secondary">No large emails found.</Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
        {(stats.sizes ?? []).map((s: StorageSizeBand) => {
          const active = drillKey?.by === 'size' && drillKey.value === s.key
          return (
            <Box
              key={s.key}
              onClick={() => s.messageCount > 0 && openDrill('size', s.key)}
              title={`${s.messageCount} emails — click to browse`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 0.75,
                py: 0.5,
                borderRadius: 1,
                cursor: s.messageCount > 0 ? 'pointer' : 'default',
                opacity: s.messageCount === 0 ? 0.4 : 1,
                bgcolor: active ? 'action.selected' : 'transparent',
                border: active ? 1 : 0,
                borderColor: 'primary.main',
                '&:hover': s.messageCount > 0 ? { bgcolor: 'action.hover' } : {},
                transition: 'background-color 150ms ease',
              }}
            >
              <Typography variant="caption" noWrap sx={{ minWidth: 100, maxWidth: 100 }}>
                {s.label}
              </Typography>
              <Box
                sx={{
                  height: 16,
                  bgcolor: active ? 'primary.main' : 'primary.light',
                  borderRadius: 1,
                  width: `${Math.max(s.messageCount > 0 ? 4 : 0, (s.totalMB / maxSizeMB) * 120)}px`,
                  flexShrink: 0,
                  transition: 'width 200ms ease, background-color 150ms ease',
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {s.messageCount > 0
                  ? `${s.totalMB.toLocaleString()} MB · ${s.messageCount} emails`
                  : '0 emails'}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </CardContent>
  </Card>
</Grid>
```

Key difference from the other cards: rows with `messageCount === 0` render at 40% opacity and are non-clickable — this avoids opening an empty DrillPanel for sparse bands.

- [ ] **Step 7: Run TypeScript build**

```bash
npm run build -w client
```

Expected: clean build, zero TypeScript errors.

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: `pass 55`.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/StorageTab.tsx
git commit -m "feat: add Storage by size card to StorageTab with clickable band drill-down

Bands: <500KB, 500KB-1MB, 1-5MB, 5-10MB, 10-25MB, >25MB.
Empty bands render at 40% opacity and are non-clickable.
Drill-down opens DrillPanel with selectable messages and floating trash tray.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final verification

**Files:** (read-only)

- [ ] **Step 1: Full build**

```bash
npm run build -w client
```

Expected: `✓ built in ~Xs` with no TypeScript errors.

- [ ] **Step 2: Full test suite**

```bash
npm test
```

Expected: `pass 55, fail 0`.

- [ ] **Step 3: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

Verify in the browser (http://localhost:5173):
1. Open Storage tab → wait for analysis to complete
2. Confirm a new card "Storage by size" appears alongside Senders, Month, Year cards
3. Each size band shows a bar + count
4. Bands with 0 emails are greyed out and not clickable
5. Click an active band → DrillPanel opens below with messages for that size range
6. Drill messages are sorted largest-first
7. Select messages via checkbox → floating tray appears → "Move to Trash" → confirm dialog
8. After trash: messages disappear from DrillPanel and count updates
9. Click the same band again → DrillPanel closes (toggle)
10. Refresh button resets cache and clears drill state

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Edge cases to be aware of

- **Very sparse accounts**: `aggregateBySizeBand` always returns all 6 bands (even if `messageCount === 0`). The UI greys them out. This is intentional — users can see which bands are empty without confusion.
- **Cache cold on drill**: If `getDrillDownMessages('size', key)` returns `null` (cache cold), the route returns 404. The client's `openDrill()` already handles this with `handleApiError` which sets the error banner. No special handling needed.
- **Band boundary precision**: Boundaries use exact byte values (not rounded MB). A 512 000-byte message is in `500k-1m`, not `lt500k` — consistent with `>=` lower bound, `<` upper bound.
- **`lt500k` band**: The storage query fetches messages `larger:1M` from Gmail, so the `< 500 KB` and `500 KB – 1 MB` bands will always be empty unless the cache was built with a smaller threshold in the future. The UI handles this gracefully by greying empty bands.
