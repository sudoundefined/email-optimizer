# EmailDiet Design System & UI Rules (v2)

This document defines the styling and UI development constraints for every screen and component. It reflects the **actual implementation** in `client/src/theme/` and is the source of truth for UI work. Architecture and implementation details live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

The design language is **Apple HIG-inspired** — system font stack, translucent "glass" materials, rounded forms, hairline separators, restrained shadows — expressed through **two curated color themes** (Botanical Forest and Espresso), each with full light and dark variants. The stock Apple system palette (systemBlue etc.) is **not** used.

---

## 1. Typography

| Element | Specification |
|---------|--------------|
| **Primary font** | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif` — renders SF on Apple devices, native sans elsewhere. No web-font import. |
| **Mono font** | `ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace` — for values and metadata. |
| **Headings** | Weight 700, negative letter-spacing (`-0.01em` to `-0.02em`). |
| **Controls/labels** | Weight 500–600. Buttons, tabs, and tags use weight 600. |
| **Body** | Weight 400. |

---

## 2. Theme System

### 2.1 How theming works

Two independent axes, both persisted:

1. **Theme** (`botanical` or `espresso`) — selected via `useAppTheme()` from `theme/ThemeContext.tsx`, which exposes `{ theme, setTheme }` and persists to `localStorage` under the `app-theme` key (default: `botanical`).
2. **Color mode** (light or dark) — Chakra's `useColorMode()` toggle in `App.tsx`. Config is `initialColorMode: 'light'`, `useSystemColorMode: false` — there is **no OS `prefers-color-scheme` sync**.

Both themes are built with `extendTheme` in `theme/themes.ts` and share the same component overrides (`baseComponents`) and semantic token names, so components are theme-agnostic.

### 2.2 Palettes

Single accent per theme: **`brand.500`** for primary actions and selection. No per-tab accent colors.

| Token | Botanical Forest | Espresso |
|-------|------------------|----------|
| `brand.500` (primary action) | `#3E7B4C` Deep Forest | `#6E4C3E` Dark Warm Brown |
| `brand.200` | `#A8D8B9` Mint Green | `#E7B475` Warm Sandy Orange |
| `brand.400` | `#6C9D94` Muted Teal | `#C49A6A` Camel |
| `brand.700` (trays/dark surfaces) | `#2E4D38` Very Dark Green | `#4B3C32` Very Dark Espresso |
| `accent.100` (warm background) | `#F1E7D3` Cream | `#F9F2E1` Creamy Off-White |

### 2.3 Semantic tokens (use these — never hard-code hex in components)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `bg.app` | Theme cream (`#F1E7D3` / `#F9F2E1`) | `#16281e` / `#28201a` | Page background |
| `bg.card` | `whiteAlpha.800`–`900` | `blackAlpha.600` | Cards, modals, sidebar |
| `bg.glass` | `whiteAlpha.600` | `blackAlpha.400` | Lighter glass surfaces |
| `bg.input` | `white` | `whiteAlpha.100` | Inputs, selects |
| `bg.accent` | `blackAlpha.100` | `whiteAlpha.200` | Selected tab pills |
| `bg.tray` | `brand.700` tone | Darker variant | Floating action trays |
| `bg.hover` | `blackAlpha.50` | `whiteAlpha.100` | Hover states |
| `text.primary` | Near-black theme tone | Theme cream | Primary text |
| `text.secondary` | `brand.500` tone | `brand.200` tone | Secondary text |
| `text.inverse` | `white` | `white` | Text on trays/filled buttons |
| `border.glass` | `whiteAlpha.600` | `whiteAlpha.200` | Glass card borders |
| `border.subtle` | `blackAlpha.200` | `whiteAlpha.200` | Hairline separators |
| `brand.icon` | `brand.500` tone | `brand.200` tone | Icon tint |

---

## 3. Shapes, Materials & Shadows

| Element | Specification |
|---------|--------------|
| **Buttons / Tabs / Tags** | Pill-shaped — `borderRadius: full`, weight 600. Buttons default to `colorScheme: brand`. |
| **Cards / Modals** | Chakra `3xl` (24px) corners, `bg.card` fill, `border.glass` 1px border, `backdrop-filter: blur(12px)`. |
| **Inputs / Selects** | Chakra `xl` (12px) corners, `bg.input` fill, `border.subtle` border, `brand.400` hover, `brand.500` focus ring. |
| **Sidebar** | `bg.card` + `backdrop-filter: blur(20px)`, `3xl` corners (md+), `border.glass` border. |
| **Floating action trays** | `bg.tray` (theme's darkest tone), white text, solid brand primary + red destructive buttons. |
| **Shadows** | Chakra `xl` (cards) / `2xl` (modals); hero surfaces `0 20px 40px -10px rgba(0,0,0,0.1)`. Neutral only — no colored glows. |
| **Separators** | Hairline alpha borders (`border.subtle`, `border.glass`). No heavy dividers. |
| **Spacing** | 8px rhythm (8/16/24/32/48/64); Chakra spacing units (1 = 4px) for fine control. |
| **No sharp corners** | Never `border-radius: 0` on visible surfaces. |

---

## 4. Layout Patterns

- **Shell**: Persistent left sidebar (drawer on mobile) with four pill nav items — **Mailbox**, **Storage**, **Labels**, **Account & Logs** — plus theme switcher, color-mode toggle, digest settings, and `AccountBadge`.
- **Unauthenticated**: `LandingPage` (SaaS marketing hero + Google sign-in). `ConnectScreen` is the legacy login card.
- **Two-Pane Master-Detail** for data-heavy tabs (Storage, Labels): left pane `GridItem` `md=4 lg=3` for navigation/aggregation, right pane `md=8 lg=9` for tables and drill-down.
- **Tables**: Sentence Case headers on `brand.50` header background, 1px border, selected rows get an inset 3px left-edge highlight (no background change), standard pagination.

---

## 5. Component Inventory (reuse before writing new UI)

| Component | Purpose |
|-----------|---------|
| `LandingPage` | SaaS marketing page + Google OAuth login (unauthenticated view) |
| `ConnectScreen` | Legacy OAuth login card |
| `AccountBadge` | User avatar, email, profile trigger, logout |
| `AccountPage` | Full profile, scanning preferences & session security |
| `LogsPage` | Dedicated Activity Audit Log page with search & action filters |
| `UserProfileModal` | Profile & preferences modal variant |
| `MailboxTab` | Primary sender management workspace |
| `ScanControls` | Scan launcher + time range + stats |
| `ScanLoader` | Animated scan progress (listing → fetching → grouping) |
| `FilterToolbar` | Smart filter chips (engagement/cleanup/category) |
| `TagSearchInput` | Chips-based multi-filter search input with suggestions and explicit Search trigger |
| `SenderTable` | Sortable sender table with bulk selection and category badges |
| `UnsubscribePanel` | Batch unsubscribe progress and results |
| `LabelReview` | Label assignment review dialog |
| `LabelManager` | System/User/App label sidebar + message drill-down |
| `ProtectedTab` | Protected sender whitelist manager |
| `StorageTab` | Two-pane storage analyzer with drill-down |
| `DigestSettingsDialog` | Weekly digest schedule configuration |
| `ConfirmDialog` | Confirmation dialog with arming delay + typed confirm |
| `AnimatedProgress` | ProgressBar.js circular/linear indicators |
| `EmailLoader` | Animated envelope loader for async operations |

---

## 6. Non-Negotiable UI Rules

1. **Semantic tokens only** — style via `bg.*`, `text.*`, `border.*`, `brand.*`. Never hard-code hex values in components.
2. **Verify all four renderings** — every screen must look correct in Botanical + Espresso × light + dark.
3. **Destructive actions** always go through `ConfirmDialog` (trash, unsubscribe, label removal, account deletion).
4. **Long-running operations** use `useJob` (SSE + poll fallback) with `EmailLoader`, `ScanLoader`, or `AnimatedProgress` — never block the UI.
5. **Reuse the inventory** in §5 before creating new components.
6. **Pill geometry** for all interactive controls; `3xl` glass for all surfaces.
