# Mailbox Tab UI Redesign Plan

**Goal:** The senders table is the product — make it the dominant surface. Today it gets ~67–75% of the width and starts a few hundred pixels down the page behind stacked cards and banners. Target: main focus area ≥ 80% width on desktop, table header visible without scrolling, one visual layer of chrome.

**Design direction** (from ui-ux-pro-max design-system run, adapted): flat dense-dashboard — density 8/10 spacing scale (8–32px), minimal elevation, one glass surface per view, single primary CTA per screen. **Keep the existing botanical/espresso semantic tokens** (`bg.*`, `text.*`, `border.*`, `brand.*`) — the generic blue palette from the tool is rejected; this is a layout/density redesign, not a rebrand.

---

## 1. Diagnosis — why it looks like a mess

| # | Problem | Where |
|---|---------|-------|
| D1 | Sidebar eats 25% (lg) / 33% (md) of width as a fluid column; senders table columns truncate ("credit_cards@icic…") | `MailboxTab.tsx:698-700` (`colSpan md:4 lg:3`), `:827` |
| D2 | Vertical chrome stack pushes the table down: error/success banners + keep-progress card + unsubscribe panels + a full Card just to hold the search input | `:640-696` |
| D3 | Three separate glass cards in the sidebar (Categories / Segments / Smart Filters), each with its own uppercase header row, border, backdrop blur, and hover shadow — heavy chrome for what is one nav | `:703`, `:765`, `:812` |
| D4 | Nested scroll: Categories card scrolls inside (`maxH=280px`) inside a scrolling pane inside the page scroll | `:709`, `:700` |
| D5 | Segment rows are double-height (label + blurb + count) — tall for a 4-item nav | `:790-805` |
| D6 | Competing elevation: blur-on-blur cards, `_hover boxShadow` on nav cards that aren't actions, message view introduces yet another card style | `:703`, `:910` |
| D7 | Result banners (`trashDone`, `labelDone`, errors) render as persistent stacked boxes instead of transient feedback | top of scan block |

## 2. Target layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR (sticky, flat, borderBottom — no Card)                       │
│ [☰] [chips search ……………………………] [Search][Clear] · 200 senders · Sort ▾│
├─────────────┬────────────────────────────────────────────────────────┤
│ NAV RAIL    │  ┌ bulk action bar (appears on selection) ┐            │
│ 232px fixed │  ┌──────────────────────────────────────────────────┐  │
│ collapsible │  │ SENDERS TABLE — flex:1, sticky header, dense     │  │
│ to 56px     │  │ rows, tabular-nums, hover row actions            │  │
│             │  │                                                  │  │
│ Categories  │  │            (≈ 80–85% of viewport width)          │  │
│ Segments    │  │                                                  │  │
│ Filters     │  └──────────────────────────────────────────────────┘  │
└─────────────┴────────────────────────────────────────────────────────┘
```

### Key moves

1. **Fixed rail, not fluid column.** `templateColumns={{ base: '1fr', md: '232px 1fr' }}` (replaces the 12-col split). Collapse button shrinks it to a 56px icon rail (tooltips for labels), persisted in `localStorage`. Main area gains 10–20% width instantly; on md screens the gain is largest.
2. **One nav, zero cards.** Merge the three sidebar cards into a single flat `MailboxNav` list on the page background (no Card, no blur, no hover shadow): section labels as plain uppercase `text.secondary` rows; Categories shows top 6 + "Show all" disclosure (kills the nested `maxH` scroll); Segments become single-line rows (blurb → `Tooltip`); Smart Filters render as compact wrap chips. Active state stays `bg.accent` + `borderLeft brand.icon`, add `aria-current="true"`. Rows keep ≥40px height (44px touch on mobile).
3. **Search joins a sticky toolbar.** Kill the search Card (`:685-696`); TagSearchInput sits in one sticky flat row (`bg.app`, `borderBottom border.subtle`, `zIndex sticky`) with the rail toggle, result count, and Sort menu. The portaled dropdown already survives sticky ancestors. Saves ~70px height and one border-in-border.
4. **Banners → toasts + one status strip.** `trashDone` / `labelDone` / transient errors become `useToast` (5s, `aria-live="polite"`). Long-running jobs (keep-progress, unsubscribe) collapse into a single slim progress strip pinned between toolbar and table — never a stack of cards.
5. **Dense table.** Cell `py={1.5}`; `fontVariantNumeric: tabular-nums` on Volume/Latest; From column gets the freed flex width (target: no truncation at 1280px); numeric/badge columns fixed width; sticky `<Thead>`; per-row actions move into an icon group revealed on row hover/focus-within (keeps rows quiet). If sender lists exceed ~200 rows, virtualize (react-window) — table is already in a `flex:1 overflowY=auto` container (`SenderTable:97`).
6. **One elevation layer.** Only the table card keeps `bg.card` + blur. Rail and toolbar are flat on `bg.app`. `_hover` shadows reserved for genuinely clickable cards; dropdowns/modals keep `xl`.
7. **Message view = same frame.** Drill-down replaces only the table region (rail + toolbar persist); back button lives in the toolbar. No separate card style — same surface as the table card.
8. **Mobile (base).** Rail becomes a `Drawer` from the toolbar's ☰; table rows collapse to two-line list items (sender + volume/badges); toolbar wraps to two rows. No horizontal scroll at 375px.

## 3. What does NOT change

- All server code; all `searchQuery.ts` / `TagSearchInput` internals (placement only).
- Semantic tokens, pill radius/weight-600 conventions, brand colors.
- **Security invariant:** bulk Trash remains allow-listed-`activeFilter`-key only; tag-search results stay view/label-only.

## 4. Implementation phases

| Phase | Scope | Touches |
|-------|-------|---------|
| A | Grid → `232px 1fr`, sticky toolbar row, move TagSearchInput into it | `MailboxTab.tsx` layout JSX |
| B | Extract `MailboxNav.tsx` (merged flat nav + collapse + disclosure), delete 3 sidebar cards | new component + `MailboxTab.tsx` |
| C | Toasts for done/error banners; single progress strip | `MailboxTab.tsx` |
| D | Table density, sticky header, hover row actions, tabular-nums; (opt) virtualization | `SenderTable` in `MailboxTab.tsx` |
| E | Message-view frame alignment + mobile drawer/list | `MailboxTab.tsx` |
| F | Polish pass: contrast (`text.secondary` on `bg.app` ≥4.5:1), focus rings, `prefers-reduced-motion`, 375px/768px/1280px checks; `npm test -w client` + build | all |

Each phase is independently shippable; A+B alone deliver the "main area too small" fix.

## 5. Acceptance checklist

- [ ] Senders table ≥80% width at 1440px, ≥75% at 1024px; From column untruncated at 1280px
- [ ] Table header visible on load without scrolling (with a completed scan)
- [ ] Exactly one blurred/elevated surface in the default view
- [ ] No nested scrollbars in the rail
- [ ] Rail collapsible + persisted; drawer on mobile; nav rows ≥44px touch height
- [ ] Toasts replace persistent result banners (`aria-live`)
- [ ] Keyboard: tab order toolbar → rail → table; visible focus rings; `aria-current` on active nav
- [ ] 48 existing client tests still pass; build clean
