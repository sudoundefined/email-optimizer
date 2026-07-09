# Design Rules and System Constraints (Clean Minimalist)

This document defines the strict styling and UI development constraints that must be followed on every screen and component. We are using a Clean Minimalist, SaaS-inspired design language.

---

## 1. Typography and Fonts

### Font Categories
We classify text into a robust, premium UI font stack:
*   **Primary Font**: The entire application uses a modern sans-serif. Priority order: `Inter`, `SF Pro Display`, `Roboto`, or `system-ui`. This ensures maximum legibility and a professional SaaS feel.
*   **Mono Font**: For code elements, badges, values, timestamps, and metadata. Options: `JetBrains Mono`, `Fira Code`, or `IBM Plex Mono`.

### Typography Hierarchy
*   **Hierarchy Scaling**: Use standard, comfortable scaling (e.g., 14px body, 16px subtitle, 24px/32px headers) to ensure readability. Avoid extreme jumps in sizing.
*   **Font Weights**: Use standard font weights (400 for body, 500/600 for buttons/labels, 700/800 for headers).

---

## 2. Color System

All colors must be controlled via CSS variables (or themed design tokens). The layout follows the 80-15-5 rule (Base, Text, Accent).

### CSS Variables Definition
```css
:root {
  /* Dominant Color: Used for text and icons */
  --color-dominant: #1e293b;       /* Slate 800 */
  --color-dominant-light: #f3f4f6; /* Gray 100 - App Background */
  
  /* Accent Color: Vibrant Electric Blue for primary buttons, active states, call-to-actions */
  --color-accent: #2563eb;         /* Blue 600 */
}
```

---

## 3. Spacing, Layout, and Shapes

### Spacing Rhythm
All margins, paddings, gaps, and heights must align to an **8px grid rhythm** (multiples of 8px).
*   **Valid increments**: `8px` (1x), `16px` (2x), `24px` (3x), `32px` (4x), `48px` (6x), `64px` (8x).

### Layout & Shapes (Soft UI)
*   **Cards and Containers**: Use crisp white (`#ffffff`) for content cards floating on the light gray background.
*   **Soft Shadows**: Introduce **soft, diffuse drop shadows** (e.g., `0 4px 12px rgba(0,0,0,0.05)`) to give depth to cards.
*   **Corners**: Use squared corners (`border-radius: 0`) for layout elements, cards, and dialogs for a sharp, flat look. Use pill-shaped styles (`border-radius: 24px`) for specific inner list items, like label navigation buttons, to act as chips.
*   **Two-Pane Master-Detail Pattern**: For data-heavy tabs (Inbox, Storage, Labels), use a full-width two-pane layout (Grid). The left pane acts as navigation/filtering and the right pane displays detailed lists or tables.

---

## 4. Component Inventory and Reuse

Before writing custom UI markup, you must reuse the primitives and existing components from the workspace.

### Core Component Inventory (MUI / TSX)
Always import and reuse these component files:

| Component | Purpose / Usage | Relative Import Path (from `client/src/components` or siblings) |
| :--- | :--- | :--- |
| `AccountBadge` | Renders user email, initials, avatar, and logout | `import AccountBadge from '../components/AccountBadge'` |
| `ConfirmDialog` | Standard confirmation dialog (supports arming delay & typed confirm) | `import ConfirmDialog from './ConfirmDialog'` |
| `ConnectScreen` | Full-page OAuth landing and login screen | `import ConnectScreen from './ConnectScreen'` |
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
