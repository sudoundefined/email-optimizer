# Design Rules and System Constraints (Apple Human Interface Guidelines)

This document defines the styling and UI development constraints for every screen and component. The app follows an **Apple Human Interface Guidelines (HIG)**-inspired design language: the system font, Apple system colors, rounded rectangles, translucent materials, hairline separators, and restrained shadows.

---

## 1. Typography and Fonts

### Font Categories
*   **Primary Font**: The San Francisco system stack — `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif`. This renders as SF on Apple devices and a native system sans elsewhere; no web-font import.
*   **Mono Font**: For code, values, and metadata — `ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace`.

### Typography Hierarchy
*   **Scale (HIG-inspired, tuned for a dense web app)**: 15px body, 13px secondary body, 17–22px section titles, 28px page title. Negative letter-spacing (`-0.01em` to `-0.02em`) on headings.
*   **Font Weights**: 400 body, 500/590/600 for controls and labels, 700 for headers. (SF's 590 "semibold" is used for buttons.)

---

## 2. Color System

Colors are Apple system colors, exposed as Chakra UI semantic tokens and CSS variables.

### System palette
```css
:root {
  --color-dominant: #1C1C1E;              /* label (primary text/icons) */
  --color-dominant-light: #F2F2F7;        /* systemGroupedBackground */
  --color-accent: #007AFF;                /* systemBlue */
  --color-accent-soft: rgba(0,122,255,0.10);
  --hairline: rgba(60,60,67,0.18);        /* separator */
}
```
Full system set: blue `#007AFF`, indigo `#5856D6`, green `#34C759`, orange `#FF9500`, red `#FF3B30`, pink `#FF2D55`, teal `#00C7BE`. Secondary text is `rgba(60,60,67,0.60)`. Use a **single accent** (systemBlue) for primary actions and selection — avoid per-tab accent colors.

---

## 3. Spacing, Layout, and Shapes

### Spacing Rhythm
Align margins, paddings, gaps to an **8px grid** (8/16/24/32/48/64). Chakra UI `spacing` units (1 = 4px) are fine for finer control.

### Layout & Shapes (Apple materials)
*   **Cards and Containers**: Crisp white (`#ffffff`) surfaces on the `#F2F2F7` grouped background.
*   **Corners (rounded rectangles)**: Cards/panes **14px**, dialogs **18px**, floating trays **16px**, inputs/buttons **10px**, small chips/badges **8px**. **No sharp `border-radius: 0` corners** on visible surfaces.
*   **Soft Shadows**: Restrained, neutral shadows — cards use `0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.05)`. Avoid colored glows.
*   **Materials / translucency**: The top toolbar is a frosted material — `rgba(255,255,255,0.72)` with `backdrop-filter: saturate(180%) blur(20px)`. Floating action trays use a dark material — `rgba(28,28,30,0.92)` with backdrop blur, white text, solid Apple-colored buttons (systemBlue primary, systemRed destructive).
*   **Separators**: Hairline borders at `rgba(60,60,67,0.10–0.18)` instead of heavy dividers.
*   **Two-Pane Master-Detail Pattern**: For data-heavy tabs (Senders, Inbox, Storage, Labels), a full-width two-pane Grid — left pane navigates/filters, right pane shows lists/tables.
*   **Table Aesthetics**: Data tables use Sentence Case headers with `brand.50` backgrounds, and a subtle 1px border. Selected rows show a solid left-edge highlight border (`inset 3px`) without altering the background color. All tables implement standard pagination.

---

## 4. Component Inventory and Reuse

Before writing custom UI markup, you must reuse the primitives and existing components from the workspace.

### Core Component Inventory (Chakra UI / TSX)
Always import and reuse these component files:

| Component | Purpose / Usage | Relative Import Path (from `client/src/components` or siblings) |
| :--- | :--- | :--- |
| `AccountBadge` | Renders user email, initials, avatar, and logout | `import AccountBadge from '../components/AccountBadge'` |
| `ConfirmDialog` | Standard confirmation dialog (supports arming delay & typed confirm) | `import ConfirmDialog from './ConfirmDialog'` |
| `ConnectScreen` | Full-page OAuth landing and login screen | `import ConnectScreen from './ConnectScreen'` |
| `EmailLoader` | Reusable animated envelope concept loader for async operations | `import EmailLoader from './EmailLoader'` |
| `FilterToolbar` | Preset query chip toolbar for email filtering | `import FilterToolbar from './FilterToolbar'` |
| `InboxTab` | Comprehensive list of inbox emails with batch operations | `import InboxTab from './InboxTab'` |
| `LabelManager` | System for updating, creating, and applying labels | `import LabelManager from './LabelManager'` |
| `LabelReview` | Inline label inspector and creator | `import LabelReview from './LabelReview'` |
| `ProtectedTab` | Manager for whitelisted/protected senders | `import ProtectedTab from './ProtectedTab'` |
| `ScanControls` | Scanning trigger buttons with status messages | `import ScanControls from './ScanControls'` |
| `SenderTable` | Table of email senders with selection, volume stats, and action history | `import SenderTable from './SenderTable'` |
| `SendersTab` | Top-level layout for the Senders analytics workspace | `import SendersTab from './SendersTab'` |
| `StorageTab` | Storage analyzer indicating large attachments and clean-up options | `import StorageTab from './StorageTab'` |
| `UnsubscribePanel` | Shows progress and summary of active batch unsubscribe operations | `import UnsubscribePanel from './UnsubscribePanel'` |
| `DrillPanel` | A side pane drawer that shows specific item details | `import DrillPanel from './DrillPanel'` |
