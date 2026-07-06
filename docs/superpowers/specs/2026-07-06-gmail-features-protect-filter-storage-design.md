# Gmail Features: Protect-list, Quick-filter Toolbar, Storage Recovery

**Date:** 2026-07-06  
**Status:** Approved for implementation  
**Context:** Addressing three equal pain points in Gmail inbox management: inbox zero maintenance (A), better email triage (B), and email archaeology (C).

## Overview

This spec covers three independent but complementary features for the Gmail email unsubscriber app:

1. **Sender protect-list (A)** — prevents recurring clutter from trusted senders (banks, utilities, receipts)
2. **Quick-filter toolbar (B)** — one-click views into inbox segments for faster triage
3. **Storage recovery dashboard (C)** — analytics-driven cleanup for large/old emails

All three features integrate cleanly with the existing codebase (React/Vite + Express, no DB, Gmail API as source of truth). Zero breaking changes — all new routes are additive.

## Goals

- **Immediate relief across all three pain points** — parallel breadth approach, not sequential depth
- **Maintain design consistency** — reuse existing "sorting office/airmail" design system (Archivo + IBM Plex Mono, airmail blue primary, postal red for destructive)
- **Preserve existing patterns** — follow established service/route/component structure
- **No breaking changes** — additive only, existing flows untouched

## Non-goals (for this iteration)

- UI framework migration (separate project, tackled after these features ship)
- AI-powered features (Claude API integration)
- Multi-account support
- Outlook integration

---

## Feature 1: Sender Protect-List

### Purpose

Prevent accidental unsubscribe/trash of important senders (banks, utilities, receipts, family). Users hit this when bulk-cleaning: "I just unsubscribed from my bank statement emails."

### Behavior

**Smart auto-protection with manual override:**

- After each scan, `protectService.autoProtectFromScan()` analyzes results and flags senders matching heuristics:
  - **Domain patterns:** `@chase.com`, `@wellsfargo.com`, `@paypal.com`, `@venmo.com`, `@irs.gov`, `@uscis.gov`, utility companies (e.g., `@pge.com`, `@att.com`)
  - **Subject keywords:** "statement", "invoice", "receipt", "bill", "payment due"
  - Future: open to adding more patterns based on user feedback
  
- Auto-protected senders shown with blue badge in Senders table: `badge badge-blue` with "Protected" label

- User can manually protect/unprotect:
  - Select senders in Senders tab → sorting tray shows "Protect" / "Unprotect" button
  - New "Protected" sub-tab in Senders tab shows all protected senders in a table

- **Action exclusions:** When user clicks "Unsubscribe" or "Move to Trash":
  - Backend checks `protectService.isProtected()` for each selected sender
  - Excludes protected ones from the action
  - Shows inline warning: "N protected senders excluded from this action" (styled as `.banner banner-error`)

### Backend Design

**New service:** `server/src/services/protectService.js`

```javascript
// Exports:
export function listProtected() // → ['sender1@example.com', 'sender2@bank.com']
export function protectSenders([emails]) // adds to protect-list
export function unprotectSenders([emails]) // removes from protect-list
export function isProtected(email) // → boolean
export function autoProtectFromScan(scanData) // heuristic pass, returns {emails:[], reason:'domain'|'subject'}
```

**Storage:** `server/data/protected-senders.json`
```json
{
  "protected": [
    {"email": "statements@chase.com", "reason": "auto:domain", "addedAt": "2026-07-06T10:30:00Z"},
    {"email": "receipts@amazon.com", "reason": "manual", "addedAt": "2026-07-06T11:00:00Z"}
  ]
}
```

Uses atomic write pattern (tmp + rename) like `tokenStore.js`.

**New routes:** `server/src/routes/protect.js` (mounted in `index.js` as `/api/protect`)

- `GET /api/protect` → `{protected: [{email, reason, addedAt}]}`
- `POST /api/protect` body `{emails:[]}` → adds to list
- `DELETE /api/protect` body `{emails:[]}` → removes from list

**Integration points:**

- `scanService.js`: After scan completes, call `protectService.autoProtectFromScan(scanData)` to flag auto-protects
- `unsubscribeService.js`: Before running unsubscribe job, filter out protected senders
- `trashService.js`: Before running trash job, filter out protected senders

### Frontend Design

**New component:** `client/src/components/ProtectedTab.tsx`

- Sub-tab accessed via new tab button in `SendersTab.tsx` header (alongside main table)
- Table reusing `.table-card` + `.sender-table` styles
- Columns: Name/Email | Message count | Badge (Auto/Manual) | Unprotect button
- Empty state: "No protected senders yet. Protect senders to exclude them from bulk actions."

**Updates to `SendersTab.tsx`:**

- Sorting tray (bottom action bar) adds two buttons:
  - "Protect" (appears when non-protected senders selected)
  - "Unprotect" (appears when protected senders selected)
  
- Before showing Unsubscribe/Move to Trash actions:
  - Check `api.isProtected()` for selected senders
  - Show inline warning banner if any protected: "N protected senders excluded from this action"
  - Filter protected senders out of the action

**New API methods in `api.ts`:**

```typescript
protectedList: () => request<{protected: ProtectedSender[]}>('/api/protect'),
protectSenders: (emails: string[]) => request<{ok: boolean}>('/api/protect', {method: 'POST', body: JSON.stringify({emails})}),
unprotectSenders: (emails: string[]) => request<{ok: boolean}>('/api/protect', {method: 'DELETE', body: JSON.stringify({emails})}),
```

**New types in `types.ts`:**

```typescript
export interface ProtectedSender {
  email: string
  reason: 'auto:domain' | 'auto:subject' | 'manual'
  addedAt: string
}
```

---

## Feature 2: Quick-Filter Toolbar

### Purpose

Faster triage — one-click views into inbox segments instead of manually building Gmail searches. Users hit this when overwhelmed: "I have 500 unread marketing emails, where do I even start?"

### Behavior

**~10 pre-built filters mixing three categories:**

**Engagement-based** (helps spot dead subscriptions):
- "Never opened" — emails user has never read
- "Low open rate (<10%)" — senders user rarely reads
- "Always opened" — senders user consistently reads

**Cleanup-focused** (targets archaeology):
- "Old with attachments" — emails >1 year old with attachments
- "Large emails (>5MB)" — storage hogs
- "Unread >6 months" — stale unread mail

**Category combos** (quick triage by type):
- "Unread marketing"
- "Unread social"
- "Old newsletters"

Clicking a filter executes a Gmail query (e.g., `is:unread category:promotions`) and shows results in expandable panel below toolbar (reuses `.group-messages` pattern from Inbox tab).

Filter state is **session-only** (not persisted) — refreshing page clears active filter.

### Backend Design

**No new backend service** — reuses existing `inboxService.js` patterns.

Filters are Gmail query strings executed client-side:

```javascript
const FILTERS = [
  {key: 'never-opened', label: 'Never opened', query: 'is:unread older_than:6m -in:trash -in:spam'},
  {key: 'unread-marketing', label: 'Unread marketing', query: 'is:unread category:promotions -in:trash -in:spam'},
  {key: 'old-attachments', label: 'Old with attachments', query: 'has:attachment older_than:1y -in:trash -in:spam'},
  // ... ~10 total
]
```

Frontend calls existing `groupMessages(key)` endpoint with custom query strings.

### Frontend Design

**New component:** `client/src/components/FilterToolbar.tsx`

- Horizontal toolbar (styled like tabs but with badges)
- Sits above pigeonhole grid in Inbox tab
- ~10 filter buttons using `.badge` style (inactive gray, active airmail blue)
- Clicking a filter → calls `api.groupMessages(filterKey)` → shows results in expandable panel below toolbar
- Panel reuses `.group-messages` + `.message-list` patterns

**Updates to `InboxTab.tsx`:**

- Add `<FilterToolbar />` component above pigeonhole grid
- When filter active: show filtered message list, hide/dim pigeonhole grid
- Clear filter button: "Clear filter" `btn btn-ghost` to reset view

**New types in `types.ts`:**

```typescript
export interface Filter {
  key: string
  label: string
  query: string
}
```

**CSS additions to `styles.css`:**

```css
.filter-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-toolbar .badge {
  cursor: pointer;
  transition: background 120ms ease;
}

.filter-toolbar .badge:hover {
  background: var(--tint-blue);
}

.filter-toolbar .badge-active {
  background: var(--airmail-blue);
  color: #fff;
}
```

---

## Feature 3: Storage Recovery Dashboard

### Purpose

Help users reclaim storage and clean up years of accumulated mail. Users hit this when: "Gmail says I'm at 14GB/15GB and I don't know where to start."

### Behavior

**Dashboard view with 4 analytics cards:**

1. **Total storage card** — big number (e.g., "14.2 GB used") + gauge/progress bar
2. **Top senders by MB** — horizontal bar chart (e.g., "sender@example.com: 2.3GB across 450 emails")
3. **Top months by MB** — vertical bar chart (e.g., "Jan 2020: 1.8GB")
4. **Large attachments table** — sortable table (From, Subject, Size, Date)

Clicking any bar/row → drills down to filtered message list with checkboxes. Bulk-select → sorting tray "Move to Trash" action. All trashing recoverable via Gmail Trash (30-day window).

### Backend Design

**New service:** `server/src/services/storageService.js`

```javascript
// Exports:
export async function getStorageStats() // → {totalMB, senders:[], months:[], attachments:[]}
export async function getTopSenders(limit=10) // → [{email, name, totalMB, messageCount}]
export async function getTopMonths(limit=12) // → [{month:'2020-01', totalMB, messageCount}]
export async function getLargeAttachments(minSizeMB=5) // → [{id, from, subject, sizeMB, date}]
```

**Implementation approach:**

Gmail API doesn't expose direct storage-by-sender APIs, so we aggregate:

1. Query messages with `larger:1M` (1MB+) using `users.messages.list`
2. For each message: `users.messages.get(format='metadata')` → extract `sizeEstimate`, `from`, `date`
3. Group by sender → sum sizes → top N
4. Group by month → sum sizes → top N
5. Filter messages with attachments → list largest

Uses existing `rateLimiter` + `withAuthErrorHandling` patterns.

**Caching strategy:**
- First load: full aggregation (may take 10-30s for 10k+ messages) → show progress indicator
- Results cached in-memory for 5 minutes
- Manual refresh button to force re-aggregate

**New routes:** `server/src/routes/storage.js` (mounted in `index.js` as `/api/storage`)

- `GET /api/storage/stats` → full dashboard data `{totalMB, senders:[], months:[], attachments:[]}`
- `GET /api/storage/senders?limit=10`
- `GET /api/storage/months?limit=12`
- `GET /api/storage/attachments?minSize=5`

### Frontend Design

**New tab:** "Storage" alongside Senders/Inbox/Labels in `App.tsx`

**New component:** `client/src/components/StorageTab.tsx`

Dashboard layout (CSS Grid):

```css
.storage-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}
```

**4 cards:**

1. **Total storage card** — big number + progress bar (reuse airmail blue for progress fill)
2. **Top senders chart** — horizontal bar chart (simple div-based bars, no chart library)
3. **Top months chart** — vertical bar chart (simple div-based bars)
4. **Large attachments table** — reuses `.table-card` + `.sender-table` styles

**Drill-down flow:**

- Click bar/row → shows filtered message list below dashboard
- Message list reuses `.message-list` pattern with checkboxes
- Sorting tray appears with "Move to Trash" button when messages selected
- Clicking "Move to Trash" → calls existing `api.trashSenders()` flow

**New API methods in `api.ts`:**

```typescript
storageStats: () => request<StorageStats>('/api/storage/stats'),
storageSenders: (limit?: number) => request<StorageSender[]>(`/api/storage/senders?limit=${limit || 10}`),
storageMonths: (limit?: number) => request<StorageMonth[]>(`/api/storage/months?limit=${limit || 12}`),
storageAttachments: (minSize?: number) => request<Attachment[]>(`/api/storage/attachments?minSize=${minSize || 5}`),
```

**New types in `types.ts`:**

```typescript
export interface StorageStats {
  totalMB: number
  senders: StorageSender[]
  months: StorageMonth[]
  attachments: Attachment[]
}

export interface StorageSender {
  email: string
  name: string
  totalMB: number
  messageCount: number
}

export interface StorageMonth {
  month: string // 'YYYY-MM'
  totalMB: number
  messageCount: number
}

export interface Attachment {
  id: string
  from: string
  subject: string
  sizeMB: number
  date: number
}
```

**CSS additions to `styles.css`:**

```css
.storage-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.storage-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow-card);
}

.storage-big-number {
  font-family: var(--font-mono);
  font-size: 48px;
  font-weight: 700;
  color: var(--ink);
}

.storage-bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.storage-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.storage-bar-fill {
  height: 24px;
  background: var(--airmail-blue);
  border-radius: 4px;
  transition: width 200ms ease;
}

.storage-bar-label {
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
}
```

---

## Error Handling

**All Gmail API calls:**
- Go through existing `rateLimiter` (p-limit(20) + exponential backoff on 429/403/5xx)
- Wrapped in `withAuthErrorHandling` (401 → shows connect screen, deletes tokens.json)

**Feature-specific:**

**Protect-list:**
- Trying to protect/unprotect non-existent sender → 400 "Sender not found in scan"
- JSON write failures → log error, show user banner "Failed to save protected senders"

**Quick-filter toolbar:**
- Invalid Gmail query → Gmail API returns 400 → show banner "Filter failed, try another"
- Zero results → show empty state "No messages match this filter"

**Storage recovery:**
- Large aggregation queries (10k+ messages) → show progress indicator: "Analyzing storage… N messages processed"
- Timeout after 30s → return partial results with banner "Partial results shown (timed out after 30s)"
- User attempts to trash protected sender from storage view → same protection check as Senders tab

---

## Testing Strategy

**Unit tests:**
- `protectService.test.js` — heuristic detection (domain/subject patterns), isProtected logic
- `storageService.test.js` — aggregation math (groupBy sender/month, size sums)

**Manual E2E checklist (added to README):**

**Protect-list:**
- [ ] Scan inbox → bank statement senders auto-protected (blue badge shown)
- [ ] Manually protect a sender → appears in Protected tab
- [ ] Try to unsubscribe protected sender → excluded with warning banner
- [ ] Try to trash protected sender → excluded with warning banner
- [ ] Unprotect sender → disappears from Protected tab, can now be trashed

**Quick-filter toolbar:**
- [ ] Click "Unread marketing" filter → shows only unread promotions
- [ ] Click "Old with attachments" filter → shows emails >1yr old with attachments
- [ ] Clear filter → returns to pigeonhole grid view
- [ ] Filter with zero results → shows empty state

**Storage recovery:**
- [ ] Open Storage tab → dashboard shows total storage + top senders/months/attachments
- [ ] Click top sender bar → drills down to message list
- [ ] Select messages → "Move to Trash" in sorting tray
- [ ] Move to Trash → messages appear in Gmail Trash (recoverable)
- [ ] Refresh storage tab → counts update

---

## Implementation Phases

**Phase 1: Protect-list** (A)
1. Backend: `protectService.js` + routes
2. Storage: `protected-senders.json` registry
3. Frontend: `ProtectedTab.tsx` component
4. Integration: add checks to unsubscribe/trash flows
5. Tests + E2E verification

**Phase 2: Quick-filter toolbar** (B)
1. Frontend: `FilterToolbar.tsx` component
2. Integrate into `InboxTab.tsx`
3. CSS additions
4. E2E verification

**Phase 3: Storage recovery** (C)
1. Backend: `storageService.js` + routes
2. Frontend: `StorageTab.tsx` component
3. Dashboard cards + drill-down flow
4. CSS additions
5. Tests + E2E verification

Each phase ships independently — no dependencies between features.

---

## Open Questions / Future Enhancements

**Protect-list:**
- Should we allow regex patterns for power users? (e.g., `.*@.*bank\.com` protects all banks)
- Export/import protected list for multi-device sync?

**Quick-filter toolbar:**
- Should filters persist across sessions (localStorage)?
- Custom filter builder UI?

**Storage recovery:**
- Should we add "Archive instead of Trash" option?
- Add storage growth trend chart (requires historical data)?

**All features:**
- How do these features interact with Outlook support (future work)?

---

## Success Metrics (if tracked)

- **Protect-list:** % of bulk actions that exclude protected senders (should be >0% indicating it's catching important senders)
- **Quick-filter:** Filter click-through rate (which filters get used most?)
- **Storage recovery:** Average MB recovered per session

---

## Design Doc Meta

- **Author:** Claude (Sonnet 4)
- **Reviewed by:** User (deepa)
- **Date:** 2026-07-06
- **Approved for implementation:** Yes
