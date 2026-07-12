# EmailDiet 2.0 — Design Specification
### "AI Mailbox Operating System"

**Last updated:** 2026-07-12 · **Status:** APPROVED-PENDING — awaiting sign-off before implementation
**Companions:** [FEATURES.md](../../FEATURES.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md) · current theme in `client/src/theme/themes.ts`

---

## 0. Honest scope map

The redesign prompt assumes every screen has a backend. The repo's own ROADMAP says otherwise. Every screen below is tagged:

- **[LIVE]** — backed by existing endpoints; pure presentation work
- **[DERIVED]** — no new server code, but new client-side aggregation of existing data (scan cache, audit log, storage index)
- **[V9/V10]** — needs backend that doesn't exist yet (rules engine, Claude API). Designed now, built later. Never ship a dead button: these screens don't appear in nav until their backend lands.

| Screen | Tag | Backing |
|---|---|---|
| Landing | LIVE | exists, restyle |
| Dashboard (Mailbox Health) | DERIVED | scan cache + storage index + audit log + subscriptions |
| Mailbox (senders) | LIVE | current MailboxTab |
| Sender Detail | DERIVED | drill-down messages + scan stats per sender |
| Storage Dashboard + Drill-down | LIVE | StorageTab |
| Labels Dashboard + Detail | LIVE | LabelManager |
| Timeline View | DERIVED | messages grouped by date bucket |
| AI Command Center | **V10** | Claude API — design only |
| Smart Cleanup (live progress) | LIVE | job SSE already streams progress |
| AI Suggestions | **V10** (heuristic subset DERIVED) | categorizer confidence exists today; "savings" projections derivable |
| Activity Center | LIVE | audit log endpoints |
| Analytics | DERIVED | scan snapshots over time (needs snapshot persistence — small server addition, flag as V8.5) |
| Weekly Digest | LIVE | digest scheduler + preview |
| Protected Senders | LIVE | ProtectedTab |
| Global Search / Command Palette | DERIVED | tag-search engine already parses queries; palette is a client shell |
| Account | LIVE | AccountPage |
| Onboarding | LIVE | OAuth flow + first scan, restaged |
| Empty States | LIVE | presentation only |

---

## 1. Design tokens

Single source of truth. All values become Chakra semantic tokens in `themes.ts` — **no raw hex in components** (existing repo rule, kept).

### 1.1 Color — "Daylight" (new default light theme)

```
--bg-app:        #FCFCFA   warm white app canvas
--bg-card:       #FFFFFF   cards, panels
--bg-glass:      rgba(255,255,255,0.72) + blur(20px)  floating header, palette, toolbar
--bg-muted:      #F6F7F5   input wells, hover, skeletons
--border-subtle: #E9ECEF
--border-glass:  rgba(233,236,239,0.6)

--brand:         #15803D   emerald — actions & success ONLY (buttons, confirmations)
--brand-hover:   #166534
--ai:            #2563EB   royal blue — anything AI-generated (suggestions, insights, palette)
--highlight:     #8B5CF6   lavender — selection, focus accents, charts tertiary
--success:       #22C55E
--warning:       #F59E0B
--danger:        #EF4444

--text-primary:  #111827   (16.9:1 on bg-app — AAA)
--text-secondary:#6B7280   (4.83:1 on bg-app — AA)
--text-tertiary: #9CA3AF   captions ≥18px or decorative only (fails AA at body size — never body text)
```

**Rule: green is a verb.** Emerald appears only on actionable/confirmed things — primary buttons, success states, the connect CTA. Navigation, headers, cards, and chrome are neutral. AI blue marks machine-generated content so users always know what the product said vs. what the AI inferred. The current "huge green sidebar blocks" are gone.

**Dark mode** (paired, not inverted): `bg-app #0F1115`, `bg-card #16181D`, `bg-glass rgba(22,24,29,0.72)`, text `#F3F4F6 / #9CA3AF`, brand lifts to `#22C55E`, ai to `#3B82F6`, borders `rgba(255,255,255,0.08)`. Every token pair contrast-checked independently. Existing Botanical/Espresso themes remain as user-selectable "personalities" mapped onto the same token names — the switcher stays.

### 1.2 Typography — Inter (variable)

| Role | Size/Line | Weight | Usage |
|---|---|---|---|
| `display` | 36/44 | 700, -0.02em | page titles |
| `headline` | 24/32 | 600, -0.01em | section heads |
| `stat` | 32/36 | 700, tabular-nums | card numbers (counts up) |
| `title` | 17/24 | 600 | card titles, row primaries |
| `body` | 15/24 | 400 | default |
| `label` | 13/16 | 500 | buttons, badges, nav |
| `caption` | 13/18 | 400 | secondary text, timestamps |
| `mono` | 13/18 | 450 | queries, IDs (JetBrains Mono) |

`font-display: swap`, preload the two critical weights (400/600) only. Body never below 15px desktop / 16px mobile.

### 1.3 Space, radius, elevation, z

- **Space:** 8-point scale — 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Section rhythm: 24 within card, 32 between cards, 48 between page sections.
- **Radius:** cards 18 · buttons/inputs 12 · floating panels 20 · pills 999. Nothing else.
- **Elevation (3 stops, neutral shadows only):**
  `e1` 0 1px 2px rgba(17,24,39,.05) — resting card
  `e2` 0 4px 12px rgba(17,24,39,.08) — hover, dropdowns
  `e3` 0 12px 32px rgba(17,24,39,.12) — floating toolbar, palette, modals
- **Z scale:** 0 content · 10 sticky · 20 floating toolbar · 40 dropdown · 100 modal · 1000 toast.
- **Glass discipline:** blur is reserved for *floating layers* (header, command palette, floating toolbar, drawers) — surfaces that sit over content. Cards are opaque white. This kills the current blur-on-blur soup and follows `blur-purpose`.

### 1.4 Iconography & illustration

- **Lucide** (via `lucide-react`), 1.5px stroke, 20px default / 16px dense / 24px nav. One family everywhere; outline at rest, filled variant only for active nav. Replaces mixed Chakra icons and the emoji glyphs in method chips (`⚡ ✉ 🔗` → `Zap`, `Mail`, `Link` SVGs).
- **Illustration:** thin-line + one accent tint (lavender or ai-blue at 20%), floating abstract "mail plane / paper stack" motifs. Used only in empty states, onboarding, and the landing hero. No stock 3D blobs.

### 1.5 Motion tokens

| Token | Value | Use |
|---|---|---|
| `fast` | 150ms ease-out | hover, press, chips |
| `base` | 220ms cubic-bezier(0.16,1,0.3,1) | reveals, toolbar, dropdowns |
| `slow` | 400ms same curve | page/panel transitions |
| `spring` | damping 20, stiffness 90 (framer-motion) | modals, floating toolbar entrance |
| `stagger` | 35ms/item, cap 8 items | list/card entrances |
| `count` | 800ms ease-out | stat numbers counting up |

Rules: transform/opacity only · exits at ~65% of enter duration · everything interruptible · one hero animation per view · **`prefers-reduced-motion` collapses all of it to opacity ≤150ms** (framer-motion `useReducedMotion` gate in the shared `<Motion>` wrapper).

---

## 2. Information architecture

```
Unauthenticated:  Landing → Google OAuth → Onboarding (first-run) → Dashboard
Authenticated:
├── Dashboard          insights home (NEW — becomes default tab)
├── Mailbox            senders, tag search, bulk actions (today's MailboxTab)
│    └── Sender Detail slide-over panel
├── Storage            insights → drill-down (today's StorageTab, insight-first reflow)
│    └── Sender Files  drill-down
├── Labels             dashboard → label detail (today's LabelManager)
├── Timeline           date-bucketed message view [DERIVED]
├── Activity           audit timeline (today lives inside Account — promoted)
└── Settings           account, digest, themes, security, sessions
     (AI Command Center + AI Suggestions join nav at v10; Analytics at v8.5)
Global overlays:  ⌘K command palette · floating action toolbar · toasts · scan progress strip
```

**Navigation contract:** each tab is a route (`/dashboard`, `/mailbox`, `/storage/:sender?`, …) — deep-linkable, back-button-safe, state (filters/scroll) preserved per `state-preservation`. Today's `useState('mailbox')` tab switch becomes `react-router` (the one structural refactor this redesign requires; it pays for every screen).

### 2.1 App shell

```
┌────────┬──────────────────────────────────────────────┐
│        │  ┌─ floating glass header (56px) ──────────┐  │
│  nav   │  │ breadcrumb · ⌘K search · scan · avatar │  │
│  rail  │  └────────────────────────────────────────┘  │
│  240px │                                              │
│  glass │   content · max-width 1600px · centered      │
│  → 64px│   p 32 desktop / 16 mobile                   │
│        │                                              │
│ digest │                                              │
│ theme  │        [floating toolbar appears here]       │
│ upgrade│                                              │
└────────┴──────────────────────────────────────────────┘
```

- **Sidebar:** glass, icon+label rows (44px), active = 3px lavender left indicator + filled icon + `text-primary` — *not* a green block. Collapses to 64px icon rail (tooltips), persisted; mobile = bottom sheet drawer. Bottom cluster: Weekly Digest (dot badge when a digest is due), theme switcher, Upgrade (quiet outline, never screams).
- **Header:** floating glass bar; left breadcrumb (`Mailbox / Netflix`), center ⌘K search field (reads "Search or type a command… ⌘K"), right: scan status chip (idle/last-scan-time/live progress ring), theme toggle, avatar.
- **Keyboard:** ⌘K palette · `g d / g m / g s / g l / g a` go-to · `?` shortcut sheet · `Esc` always exits the top-most layer. Skip-link before nav.

---

## 3. Screens

Grouped by implementation phase (§6). Layouts are desktop; tablet/mobile behavior in §5.

### 3.1 Dashboard — [DERIVED] *insights first, the thesis screen*

```
Row 1  ┌ Mailbox Health 96 ─┐ ┌ Today ────────┐ ┌ Storage ──────┐ ┌ Subscriptions ┐
       │ progress-ring, count│ │ scanned/freed │ │ used GB, spark│ │ 7 active, ▲2  │
Row 2  ┌ Recommendations (2/3 width) ──────────┐ ┌ Activity timeline (1/3) ┐
       │ ranked action cards: "229 newsletters │ │ audit events, relative  │
       │ unopened → Unsubscribe all" [ai-blue] │ │ time, icon per action   │
Row 3  ┌ Email volume area chart ──────────────┘ └ Quick actions grid ─────┘
```

- **Mailbox Health score** = weighted heuristic (unsub-able %, storage pressure, unread promo ratio) — computed client-side from scan data, ring animates 0→score on mount, counts up.
- **Recommendation cards** carry the ai-blue left rail + Lucide `Sparkles`, a one-line *why* ("110 msgs, none opened in 90 days"), a projected saving ("≈ 84 MB"), and ONE primary action. Confidence shown as Low/Med/High dots, not fake percentages — honesty rule: heuristic-derived today, Claude-ranked at v10.
- Empty (pre-scan) state: the whole dashboard becomes the onboarding scan hero — no dead zero-cards.

### 3.2 Mailbox — [LIVE] *evolution of what shipped this week*

Keeps: 232px rail, floating tag-search bar, applied-filter chips, dense table, drawer on mobile.
Changes:
- Table rows become **row-cards**: no vertical grid lines, 12px inner radius on hover, `bg-muted` hover, soft 1px separators; selection = lavender left bar + subtle bg tint (no inset shadow), checkbox fades in on row hover (always visible on touch).
- **Inline row actions** on hover/focus-within: `Unsubscribe · Trash · Protect · ⋯` icon group, replacing "select → travel to tray" for single-row cases.
- **Floating action toolbar** (replaces the fixed bottom tray): springs up bottom-center when selection > 0, glass e3, pill; shows `n senders · m emails`, actions with icons, and `Esc` clears. Same component serves Storage and Labels selections.
- AI category chips get a tooltip stating the categorizer's reason (data exists in `suggestion.reason`).
- Sort becomes clickable column headers with `aria-sort` (keeps the toolbar Select on mobile).

### 3.3 Sender Detail — [DERIVED] *slide-over, not a page*

480px right slide-over (spring), glass scrim: avatar + sender + protected badge → stat row (volume, first/last seen, category, method) → 12-month frequency **sparkline bar chart** → attachments summary (from storage index, if scanned) → recent messages list (drill-down endpoint) → action footer (Unsubscribe / Keep latest… / Protect / Trash all). URL: `/mailbox/sender/:email` for deep-linking. `Esc`/swipe-down dismiss.

### 3.4 Storage Dashboard + Drill-down — [LIVE]

Reflow to insight-first: hero row = **donut** (storage by category) + **stat cards** (total recoverable, largest sender, oldest heavy year) + horizontal **top-10 senders bar chart** (each bar clickable → drill-down). The existing size/sender/month/year tables move below the fold under a "Explore all data" disclosure. Drill-down keeps current table but adopts row-card styling + floating toolbar + per-file type icons; "Empty Trash" stays a red, separated, double-confirm zone.

### 3.5 Labels Dashboard + Detail — [LIVE]

Two-pane: left = label list grouped System/User with message counts and color dots; right = selected label detail (stats header, message list, apply/remove/delete actions). Create-label is the single primary button. Delete lives in an overflow menu with confirm dialog (destructive separation).

### 3.6 Timeline — [DERIVED]

Vertical timeline of drill-down/search results bucketed **Today / Yesterday / This week / This month / Older**: sticky bucket headers, 2px lavender spine with date dots, message rows as compact cards (sender avatar, subject, snippet, size). Reuses `filterMessages` + client-side bucketing; entry points: "view as timeline" toggle in any message view. Buckets stagger-fade on first paint.

### 3.7 Smart Cleanup (job progress) — [LIVE]

Job progress graduates from the slim strip to a **focus panel** when user clicks the scan/cleanup chip: circular progress (SSE-driven), live counters (scanned / trashed / freed) counting up, current-phase label, cancel button. Completion: ring snaps full, single confetti-free "success pulse" (scale 1→1.04→1 + check draw-in, 500ms total — celebratory but calm), summary line with Undo where applicable (trash is recoverable 30 days — say so). Strip remains for background awareness on other screens.

### 3.8 Activity Center — [LIVE]

Audit log promoted out of Account: filterable timeline (action type chips, date range, free-text), each event = icon + verb sentence ("Moved **1,203** messages from *Netflix* to Trash") + relative time + expandable detail. Export CSV. Search reuses the tag-search input pattern for consistency.

### 3.9 Weekly Digest — [LIVE]

Settings card (schedule day/time, enable) + **email preview pane** rendering the actual digest template with live data + send-history list with delivery status. "Send test now" secondary action.

### 3.10 Protected Senders — [LIVE]

Current ProtectedTab restyled: stat header (n protected, n auto-protected), reason badges (Bank/Gov/Manual), search, row-cards, unprotect via overflow. Educational callout: what protection blocks.

### 3.11 Search / Command Palette — [DERIVED]

⌘K opens a glass e3 palette (top-center, spring): one input that accepts **commands** ("go to storage", "scan mailbox", "unsubscribe selected") and **queries** (routes into tag-search grammar with the same chips/suggestions). Sections: Actions · Recent searches (localStorage) · Saved searches (pin icon on any applied chip-set) · Navigation. Full keyboard: ↑↓ move, ↵ run, Tab completes. This is the "OS" moment of the product — ships in phase 2, client-only.

### 3.12 Account/Settings — [LIVE]

Sectioned single page with sticky sub-nav: Profile · Preferences (theme pairs shown as live mini-previews, label prefix, digest) · Security (scopes granted, token status, disconnect) · Sessions · Data (export, delete account). Danger zone visually quarantined at bottom.

### 3.13 Onboarding — [LIVE]

Four staged screens after first OAuth (progress dots, back-capable, skippable):
1. **Welcome** — value prop, illustration
2. **Permissions** — plain-language scope explanation, "we never permanently delete" trust card
3. **First scan** — range picker prominent, live progress with streaming fun-facts from partial results ("Found 47 newsletters so far…")
4. **Ready** — health score reveal (ring animation), top 3 recommendations, "Open Dashboard" CTA.

### 3.14 Landing — [LIVE]

Restyle to the 2.0 language: warm-white hero, product screenshot in a glass browser frame with subtle float, headline ("Your inbox, on a diet — run by AI"), Google CTA (the one big emerald button), logo/social-proof strip, 3 feature triptychs (Clean / Organize / Protect) with real UI crops, security section (AES-256, OAuth scopes, no-permanent-delete), pricing (Free / Pro placeholder), footer. GSAP scroll-reveals at Standard tier; hero never blocks LCP (static first paint, motion enhances).

### 3.15 AI screens — [V10, design-complete, nav-hidden until backend]

- **AI Command Center:** chat surface (user right / AI left with `Sparkles` avatar), suggested prompt chips ("Delete all Flipkart promos", "Summarize my subscriptions"), every destructive AI plan renders as a **dry-run review card** (matched count, sample rows, explicit Confirm) — the AI proposes, the human disposes; consistent with the repo's allow-list security invariant.
- **AI Suggestions:** card grid = recommendation, evidence line, confidence dots, projected savings, one-click apply + "not for me" (feeds suppression list).

### 3.16 Empty states — [LIVE]

One `<EmptyState>` component: illustration (per-context), title, one-line guidance, single CTA. Contexts: no scan yet · no results (offer clearing filters) · no large files ("your mailbox is lean — nice") · no labels · no subscriptions · no activity. Never a bare "No data".

---

## 4. Component library (build once, in `client/src/ui/`)

| Component | Notes |
|---|---|
| `Button` | primary (emerald) / secondary (outline) / ghost / danger; press scale 0.97; loading spinner replaces label, width locked |
| `StatCard` | label, count-up number (tabular), delta arrow, optional sparkline |
| `InsightCard` | ai-blue rail, Sparkles, why-line, confidence dots, one CTA |
| `RowCard` table | soft separators, hover bg, inline actions, selection tint; virtualized ≥100 rows (react-window) |
| `FloatingToolbar` | shared selection toolbar (Mailbox/Storage/Labels) |
| `CommandPalette` | ⌘K, sections, keyboard-complete |
| `TagSearchInput` | exists — restyle tokens only |
| `Charts` | wrap **Recharts**: Area, Bar(h), Donut, Sparkline, ProgressRing; animated draw-in ≤800ms, `reduced-motion` = instant; every chart gets an sr-only summary sentence + "view as table" toggle (`data-table` rule) |
| `Timeline` | spine, buckets, event rows |
| `SlideOver` | 480px right panel, spring, focus-trapped |
| `EmptyState` | per §3.16 |
| `Dialog / Toast / Tooltip / Menu / Tabs / Badge / Chip / Skeleton` | Chakra restyled via theme, not re-built |
| `ProgressStrip` + `CleanupPanel` | job progress, SSE-fed |

Skeletons everywhere loading >300ms; shimmer 1.2s loop; skeleton shapes match real layout (CLS ≈ 0).

---

## 5. Responsive & accessibility

**Breakpoints:** 375 / 768 / 1024 / 1440 (content caps at 1600).
- **Desktop ≥1024:** full rail + slide-overs.
- **Tablet 768–1023:** rail auto-collapses to 64px icons; dashboard 2-col; slide-over goes full-height 60% width.
- **Mobile <768:** bottom drawer nav (5 items max: Dashboard, Mailbox, Storage, Search, More); tables → stacked two-line cards; floating toolbar docks above safe-area; charts simplify (donut→stat+bar, fewer ticks); all touch targets ≥44px; `min-h-dvh`.

**WCAG AA gate (per screen, before merge):**
- Contrast: every token pair verified in both modes (§1.1 values pre-checked; tertiary never on body)
- Full keyboard path incl. palette, toolbar, slide-over (focus trap + return-focus)
- `aria-current` nav, `aria-sort` headers, `aria-live=polite` toasts/progress, `role=alert` errors
- Charts: sr-only insight sentence + table alternative; color never sole encoding (icons/labels on badges)
- Reduced-motion audit: run with the media query forced, nothing must depend on motion to be usable
- Focus rings: 2px `--highlight` offset 2 — never removed

---

## 6. Implementation phases (each independently shippable)

| Phase | Scope | Size |
|---|---|---|
| **P1 — Tokens & shell** | New token set into `themes.ts` (Daylight default + dark pair, keep Botanical/Espresso), Inter, Lucide swap, react-router shell, glass header, restyled sidebar | M |
| **P2 — OS layer** | Command palette, floating toolbar (replaces tray), toasts/skeleton/empty-state components, keyboard map | M |
| **P3 — Dashboard** | StatCard/InsightCard/charts, health score, recommendations (heuristic), default-tab switch | L |
| **P4 — Mailbox 2.0** | Row-cards, inline actions, sender slide-over, sortable headers, virtualization | L |
| **P5 — Storage & Labels reflow** | Insight-first storage, two-pane labels, shared toolbar adoption | M |
| **P6 — Timeline + Activity + Digest + Protected** | Derived views + promotions | M |
| **P7 — Landing + Onboarding** | Public surface | M |
| **P8 — Polish gate** | Motion pass, a11y audit, 375px pass, dark-mode contrast audit, docs | S |
| *(V8.5)* | Analytics (needs scan-snapshot persistence server-side) | — |
| *(V10)* | AI Command Center + AI Suggestions wiring | — |

**Invariants carried through every phase (from AGENTS.md / FEATURES.md):**
1. Bulk trash stays allow-listed-key-only; free-form queries never gain a trash path
2. Zero permanent deletion outside explicit Empty Trash
3. All 48 client + 125 server tests keep passing; new components get tests
4. No raw hex in components — tokens only
5. No feature removed; every current capability has a home in the new IA

---

## 7. What this spec deliberately rejects

- **Green everywhere** → green is a verb (actions/success only)
- **Three stacked chrome bars** → one glass header + contextual overlays
- **Blur on every card** → blur only on floating layers
- **Fake AI theater** → no invented percentages, no dead AI buttons before v10; heuristics labeled as what they are
- **Celebration confetti** → calm success pulse; the product's emotion is *relief*, not fireworks
- **Emoji as icons** → Lucide only
