# CLAUDE.md — Email Optimizer

This file gives Claude full context to pick up any session immediately. Read it before writing code.

---

## Project identity

- **Repo**: `email-optimizer` at `git@github.com:sudoundefined/email-optimizer.git`
- **Purpose**: Personal Gmail cleanup tool — bulk unsubscribe, label, trash, and protect senders; browse inbox groups; reclaim storage.
- **Stack**: npm workspaces monorepo — `client/` (React 18 + Vite + TypeScript + MUI v6) and `server/` (Node ESM + Express + Google Gmail API). No database — Gmail is the source of truth.
- **Auth**: Google OAuth 2.0 (Testing mode → 7-day token expiry). Tokens stored at `server/data/tokens.json` (gitignored).

---

## Running the project

```bash
npm install                        # install all workspaces
cp server/.env.example server/.env # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm run dev                        # API :3001 + Vite :5173 via concurrently
npm test                           # 52 server-side unit tests (node --test)
npm run build -w client            # production build — must stay clean
```

**Dev server config**: `.claude/launch.json` defines the `client` preview config (port 5173).

---

## Architecture

```
client/src/
  App.tsx                  AppBar + Tabs (Senders / Inbox / Storage / Labels)
  api.ts                   Typed fetch wrapper + SSE job polling
  types.ts                 All TypeScript interfaces — single source of truth
  theme.ts                 MUI custom theme (primary #1976d2, Roboto, disableElevation)
  hooks/useAuth.ts         Auth state + polling
  hooks/useJob.ts          SSE job streaming helper
  components/
    AccountBadge           User email + logout button in AppBar
    ConnectScreen          OAuth sign-in card (unauthenticated state)
    ScanControls           Date-range picker + scan button + progress
    SenderTable            Paginated sender list with checkboxes + method chips
    SendersTab             Orchestrator: scan → select → tray actions (unsub/label/protect/trash)
    ConfirmDialog          Arming-delay + typed-count confirmation modal
    LabelReview            Category review + label apply modal
    UnsubscribePanel       SSE result stream for unsubscribe jobs
    FilterToolbar          Quick-filter chip bar (10 Gmail query shortcuts)
    InboxTab               Group cards + message drill-down + filter results + labels table
    ProtectedTab           Protected sender list (manual + auto entries)
    StorageTab             Storage dashboard: reclaimable MB, top senders/months charts, attachments table
    LabelManager           App-created Unsub/* labels with remove/trash actions

server/src/
  index.js                 Express app + route mounting + error middleware
  config.js                PORT, REDIRECT_URI, CLIENT_URL from .env
  auth/
    oauthClient.js         Google OAuth2 client, token persistence, withAuthErrorHandling()
    tokenStore.js          Read/write server/data/tokens.json
  gmail/
    client.js              getGmail() — authenticated google.gmail('v1') instance
    rateLimiter.js         limited() — p-limit concurrency + 429/5xx retry with backoff
    messages.js            listAllMessageIds(), getMetadata() — reusable Gmail API helpers
    mime.js                buildUnsubscribeEmail() — RFC 2047 MIME for mailto unsub
  jobs/
    jobManager.js          createJob(name, runner) → SSE-streamable background jobs
  store/
    scanCache.js           In-memory scan result (Map<email, sender> + messageIds)
    labelRegistry.js       Persisted list of app-created label IDs (server/data/labels.json)
  services/
    scanService.js         runScan() — paginate Gmail, group by sender, populate scanCache
    categorizer.js         categorizeSender() — domain/subject heuristic → category
    headerParser.js        parseListUnsubscribe(), isOneClickPost(), unsubscribeInfo()
    unsubscribeService.js  runUnsubscribe() — one-click POST / mailto / link surfacing
    trashService.js        runTrashSenders() — batchModify TRASH + evict from scanCache
    labelService.js        applySuggestions() — create Unsub/* labels + apply to messages
    inboxService.js        listGroups(), groupMessages(), listAllLabels(), filterMessages()
    storageService.js      getStorageStats() — fetch large emails, aggregate by sender/month
    protectService.js      protect/unprotect senders, auto-protect heuristics
  routes/
    auth.js                /api/auth/* (status, login, callback, logout)
    scan.js                POST /api/scan, GET /api/senders, POST /api/senders/trash
    unsubscribe.js         POST /api/unsubscribe
    labels.js              GET/POST/DELETE /api/labels
    inbox.js               GET /api/inbox/groups, /groups/:key/messages, /labels, /filter
    storage.js             GET /api/storage/stats, POST /api/storage/refresh
    protect.js             GET/POST/DELETE /api/protect
    jobs.js                GET /api/jobs/:id (SSE stream)
```

---

## Key patterns

### Background jobs (SSE)
All long-running operations use `createJob(name, runner)` in `jobs/jobManager.js`. The runner receives an `emit(progress)` callback. The client polls via `useJob.ts` which reads `GET /api/jobs/:id` as an SSE stream. New jobs follow this exact pattern:

```js
// server: create job
import { createJob } from '../jobs/jobManager.js'
const job = createJob('job-name', (emit) => myService.run(params, emit))
res.json({ jobId: job.id })

// service: emit progress
emit({ phase: 'working', done: n, total: total })
return { finalResult: true }  // becomes job.result
```

### API client (`client/src/api.ts`)
All API calls go through `request<T>(path, init?)`. Add new endpoints here — never use `fetch()` directly in components.

### Error handling
- Server: `withAuthErrorHandling(async () => { ... })` wraps every Gmail call → auto-converts auth failures to `NotConnectedError` → Express middleware → 401
- Client: `handleApiError(err)` in each tab → `onDisconnected()` on 401, `setError(msg)` otherwise

### MUI v6 gotchas
- All system props (`display`, `alignItems`, `gap`, etc.) must go through `sx={}` — not direct props on `Box`/`Stack`
- Checkbox: use `aria-label` prop directly (not `inputProps`)
- ListItemText: use `slotProps={{ primary: {...}, secondary: {...} }}` (not `primaryTypographyProps`)
- Icons: barrel import `import { MailOutlined } from '@mui/icons-material'` — deep imports fail with bundler moduleResolution
- Icon names end in `-ed` (e.g. `MailOutlined`, `ShieldOutlined`, `LabelOutlined`)

### Trash vs permanent delete
The app **never permanently deletes email**. All "delete" actions use `batchModify` with `addLabelIds: ['TRASH']`. Trash is recoverable in Gmail for 30 days.

---

## Data flow: scan → action

1. `POST /api/scan` → `scanService.runScan()` → populates `scanCache` (Map keyed by lowercase email)
2. `GET /api/senders` → reads `scanCache`, returns `Sender[]` sorted by `messageCount` desc
3. Client selects senders → tray appears → user clicks action
4. Action route validates senders exist in scanCache, creates a job, returns `{ jobId }`
5. Client streams job via SSE until `state === 'done'`, reads `result`

---

## Test suite

52 tests in `server/src/**/*.test.js` run with `node --test`. Tests cover:
- `headerParser.js` — RFC 2369/8058 parsing, header injection sanitization
- `categorizer.js` — domain/subject/category heuristics
- `inboxService.js` — GROUPS array invariants
- `protectService.js` — domain heuristics, manual protect/unprotect, persistence
- `storageService.js` — aggregation math (bytesToMB, aggregateBySender, aggregateByMonth, filterLargeAttachments)
- `gmail/rateLimiter.js` — retry/backoff on 429/5xx

**Never break the test suite.** Run `npm test` before committing.

---

## What's shipped (as of 2026-07-08)

- v1 Core: bulk unsubscribe (RFC 8058 one-click, mailto, manual link), sender scan + grouping, auto-categorization, label management, per-sender trash
- v2 Inbox: live group counts, message drill-down, all-labels table
- v3 Protection/filters/storage: sender protect-list with auto-heuristics, quick-filter toolbar (10 Gmail queries), storage recovery dashboard
- UI: full Material UI v6 migration (no custom CSS, all MUI components)

---

## Active development context (2026-07-08)

### Planned: Message select + trash in Inbox and Storage tabs

**Feature**: When a group card or filter is open in InboxTab, or when a sender row is clicked in StorageTab, the user can:
1. Select individual messages via checkboxes in the expanded message list
2. See a count of selected messages in a floating tray
3. Click "Move to Trash" → trash those specific message IDs directly (not via scanCache — direct Gmail batchModify)

**New backend needed**:
- `POST /api/messages/trash` — body: `{ messageIds: string[] }` → direct batchModify, no job (small batches) OR job for large batches
- Reuse `limited()` + batchModify pattern from `trashService.js`

**New frontend needed**:
- `InboxTab`: add checkboxes to `MessageList`, track `selectedIds: Set<string>`, floating tray with count + "Move to Trash" button, confirmation for >50 messages
- `StorageTab`: same checkbox pattern on the attachments table + top-senders drill-down

**Files to touch**:
- `server/src/routes/inbox.js` — add POST /api/messages/trash route (or new `routes/messages.js`)
- `server/src/services/` — add `messageTrashService.js` (thin wrapper around batchModify)
- `client/src/api.ts` — add `trashMessages(ids: string[])`
- `client/src/types.ts` — no changes needed
- `client/src/components/InboxTab.tsx` — selectable MessageList, tray
- `client/src/components/StorageTab.tsx` — selectable attachment rows, sender drill-down, tray

---

## Environment variables

```
# server/.env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
PORT=3001                                         # default
REDIRECT_URI=http://localhost:3001/api/auth/callback
CLIENT_URL=http://localhost:5173
```

---

## Git conventions

- Branch: `main`
- Remote: `git@github.com:sudoundefined/email-optimizer.git`
- Commit style: `feat:`, `fix:`, `chore:`, `docs:` prefix, present-tense body
- Co-author: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Never commit `server/.env` or `server/data/`

---

## Permissions for Claude

Run any command without asking — build, test, install, git operations are all fine. The user has explicitly granted permission for Claude to execute commands and edit files freely in this project.
