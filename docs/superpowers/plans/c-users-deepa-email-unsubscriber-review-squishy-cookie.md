# Plan: Full MUI → Chakra UI Migration + Persana-style Sidebar Redesign

## Context

The app's UI is 100% Material UI today — `client/src/main.tsx` wraps everything in MUI's `ThemeProvider`/`CssBaseline`, `theme.ts` is a 250-line MUI theme, and all ~14 components + `App.tsx` use `@mui/material` + `sx`. The most recent redesign was an Apple-HIG pass **on MUI**.

The user wants a **full replacement**: rip out MUI, rebuild the entire frontend in **Chakra UI**, restructure the shell into a **Persana-style left-sidebar dashboard** (fixed left nav + top bar + content area, per the reference screenshot), and apply a **10-color warm-brown → blue palette**. Backend, API, routes, and all server tests are UI-agnostic and are **not touched** — this is a client-only migration. Goal: identical behavior, new look and layout, zero regressions to the trash/unsubscribe/label/digest flows.

**Palette role assignment (my call, per Persana reference):**
- **Primary action** (buttons, active nav, focus, links): blue ramp — `#48a3ee` (500) with `#63b1f1` (400) / `#367bb3` (600) / `#245277` (700). Persana's CTAs are blue; this keeps that feel.
- **Brand / accent / section highlights** (logo mark, "current section" strip, chips, subtle warm surfaces): warm ramp — `#b1682c` / `#ec8a3a` / `#f09f5e`, with `#f8cfaf` as a light warm surface and `#76451d` as deep warm text-on-warm.
- **Info/soft tint**: `#b1d8f8`.
- Full ramp exposed as Chakra semantic tokens (`brand.*` warm, `blue.*`/`accent.*` blue) so components reference tokens, not hex.

---

## Migration strategy (bottom-up, keep it green at every step)

Chakra is a different paradigm from MUI: `sx` → style props / `chakra()`; theme via `extendTheme`; components have different names/APIs (`Dialog`→`Modal`, `Select`→`Select`/`Menu`, `Table` is lower-level, `Chip`→`Tag`, `Alert` differs, `Snackbar`→`useToast`, `LinearProgress`→`Progress`, `CircularProgress`→`Spinner`, `Tabs` differ, `Checkbox`/`Switch`/`TextField`→`Input`/`FormControl`). So this is a rewrite of the view layer, not a find-replace. **All hooks, state, `useJob`/SSE, `api.ts` calls, and business logic stay byte-for-byte identical** — only JSX + styling change.

### Phase 0 — Dependencies & providers
- Remove `@mui/material`, `@mui/icons-material` from `client/package.json`; add `@chakra-ui/react`, `@chakra-ui/icons`, `framer-motion` (Chakra peer). Keep `@emotion/react`/`@emotion/styled` (Chakra uses Emotion too).
- New `client/src/theme.ts` → `extendTheme({...})`: define the palette as color scales, semantic tokens, global styles (SF/system font stack is fine to keep), and component base styles (Button, Card, Table, Modal, Tabs, Input, Tag, Alert). This replaces the MUI theme 1:1 in role.
- Rewrite `main.tsx`: `<ChakraProvider theme={theme}>` (Chakra ships its own reset — drop `CssBaseline`).

### Phase 1 — App shell → Persana sidebar (`App.tsx`)
Replace the current top-AppBar+Tabs shell with a **three-region dashboard**:
- **Left sidebar** (fixed, ~240px): brand mark + app name at top; vertical nav items **Senders / Inbox / Storage / Labels** with icon + label, active item highlighted (warm-tinted pill + blue left-accent); bottom section for **Weekly digest** (opens the existing dialog) and **Sign out** (`AccountBadge` logic). Collapsible on mobile (Chakra `useDisclosure` + `Drawer`).
- **Top bar**: current-section title + a right cluster with the account avatar/email (reuse `AccountBadge` data) and the digest/settings action.
- **Content region**: renders the active tab component (unchanged component boundaries — `SendersTab` etc. still receive `onDisconnected`).
- Keep the same `tab` state machine and `auth` gating; only the chrome changes. Responsive: sidebar → drawer under `md`.

### Phase 2 — Leaf/shared components first (so tabs have primitives to use)
Rebuild these in Chakra, preserving props/behavior exactly:
- `ConnectScreen.tsx`, `AccountBadge.tsx` — simplest; validate palette + provider wiring here first.
- `ConfirmDialog.tsx` (MUI `Dialog`→ Chakra `Modal`; **preserve `requireTypedCount` + arming-delay logic verbatim** — it guards destructive trashes), `UnsubscribePanel.tsx`, `FilterToolbar.tsx`, `ScanControls.tsx` (incl. the **Cancel** button + range select), `LabelReview.tsx` (dialog + the **archive checkbox**), `DigestSettingsDialog.tsx` (`Modal` + `Switch`/`Select`/`Input`), `ProtectedTab.tsx`.

### Phase 3 — The four data-heavy tabs (highest risk — the trays & tables)
Rebuild in Chakra, one at a time, verifying each before the next:
- `SenderTable.tsx` + `SendersTab.tsx` — two-pane master-detail (Chakra `Grid`/`Flex`), left filter pane (search `Input`, segment list incl. **Subscriptions**, category chips → `Tag`), right pane with sort `Select` + the **client-side pagination** (rebuild the `TablePagination` behavior with Chakra controls, keep `safePage` clamp), and the **floating action tray** (fixed `HStack`, all buttons always-rendered/disabled — preserve the anti-jitter fixed-width design and every handler: unsubscribe/label/protect/unprotect/keep-latest/trash/clear).
- `InboxTab.tsx` — filter chips + group list + selectable message list + trash tray + "trash all matching".
- `StorageTab.tsx` — hero card, left nav cards (date/senders/size), right DrillPanel + attachments table, both paginated, trash tray.
- `LabelManager.tsx` — two-pane label list + message drill-down + trash tray + confirm dialogs.

Each tab keeps its exact data flow, selection sets, `useJob` usage, and API calls. Only markup/styling is reauthored.

### Phase 4 — Cleanup, review, verify, merge
- Delete dead MUI imports; confirm `@mui/*` no longer appears anywhere (`grep -r "@mui" client/src` → empty).
- Adversarial review (correctness/regression + visual/contrast): destructive confirmations intact (typed-count on >500 sender trash, >50 message trash), protect-list still gates trays, pagination select-all is page-scoped, palette contrast passes on both warm and blue surfaces, responsive sidebar works.
- `npm run build -w client` clean; server `npm test` still green (untouched). Live smoke test each tab.
- Branch `feat/chakra-persana-redesign`; merge to `main` after green.

---

## Critical files
- `client/package.json` — swap MUI deps for Chakra (Phase 0)
- `client/src/main.tsx` — `ChakraProvider` (Phase 0)
- `client/src/theme.ts` — full rewrite to `extendTheme` with the 10-color palette as tokens (Phase 0)
- `client/src/App.tsx` — top-tabs shell → left-sidebar dashboard (Phase 1)
- All `client/src/components/*.tsx` (14 files) — reauthored view layer, logic preserved (Phases 2–3)

## Reuse / preserve verbatim (do NOT change)
- `hooks/useAuth.ts`, `hooks/useJob.ts`, `api.ts`, `types.ts` — untouched.
- Every event handler and state machine inside components (selection `Set`s, `runTrash`/`runUnsubscribe`/`runKeepLatest`/`runFilterTrash`, `safePage` pagination clamp, tray disabled-conditions, `ConfirmDialog` typed-count + arming delay).
- All server code, routes, and tests.

## Verification (end-to-end)
- `grep -r "@mui" client/src` returns nothing; `npm run build -w client` passes with no TS errors.
- `npm test` (server) stays green (105 tests) — proves logic untouched.
- Live: sign in → sidebar nav switches tabs → scan → Senders two-pane with segments/sort/pagination and the floating tray (unsubscribe/label/keep-latest/protect/trash all fire) → Inbox trash-all-matching → Storage drill + trash → Labels drill + trash → digest dialog opens from the sidebar. Confirm typed-count dialogs still appear for large trashes and protected senders are still excluded.
- Responsive: sidebar collapses to a drawer under `md`; trays/tables remain usable on mobile widths.

---

## Deferred (unchanged from before — not part of this UI pass)
Finance/Career + the shared AI extraction primitive remain deferred (need `ANTHROPIC_API_KEY` + email-body reads). The Gmail App Password / SMTP wizard was **dropped** (App Passwords can't drive the Gmail-API features; user chose to skip it).
</content>
