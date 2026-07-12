# EmailDiet — Agent Coding Guidelines

This document contains rules and guidelines that **must** be followed by any AI agent or developer working on the EmailDiet project.

---

## 🛡️ Invariants & Safety Rails (NEVER VIOLATE)

1. **Gmail as the Source of Truth:** Never store email bodies or messages locally. Read metadata headers (`From`, `Subject`, `Date`, `List-Unsubscribe`, `List-Unsubscribe-Post`) on the fly, and use in-memory caches (like `scanCache.js`) for the session.
2. **Safe Deletion Default:** All cleanup routes (trash senders, trash messages, keep-latest, filter-trash) must move emails to the Gmail `TRASH` label only. Never call permanent deletion APIs, except for the explicit user-triggered **Empty Trash** path (`messages.batchDelete` scoped strictly to `in:trash`).
3. **Multi-User Isolation:** Every SQLite row and backend service call must be strictly partitioned by `userId`. Pass `userId` as the first parameter to all service functions.
4. **Token Encryption:** OAuth tokens must be stored encrypted using AES-256-GCM (NIST SP 800-38D, 12-byte base64 IVs) in the database.
5. **SSRF Protection:** One-click unsubscribe POST calls must be restricted to HTTPS and check resolved IP addresses to block private ranges, localhost, and loopbacks.

---

## 💻 Backend Coding Rules

1. **Service Signatures:** Service functions must accept `userId` first:
   ```js
   export async function myService(userId, options, emit, signal) { ... }
   ```
2. **Gmail API Rate Limiting:** Never call the raw `gmail` object directly. Wrap all queries using `limited` from `gmail/rateLimiter.js` (`p-limit(20)`) and the helper methods in `gmail/messages.js` to automatically handle 429/5xx exponential backoffs.
3. **SSE Endpoints:** Server-Sent Event (SSE) streaming connections must use `safeSend()` with checks for `res.destroyed || res.writableEnded` to prevent proxy `ECONNRESET` crashes on client disconnect:
   ```js
   const safeSend = (event, data) => {
     if (res.destroyed || res.writableEnded) return
     try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }
     catch { /* socket dead */ }
   }
   ```
4. **Activity Audit Trail:** Log all key database or Gmail mutations (`scan`, `unsubscribe`, `trash`, `label`, `keep_latest`, `login`, `logout`) in the `activity_log` table via `auditService.logActivity`.

---

## 🎨 UI & Design Rules (DESIGN.md)

1. **Semantic Tokens only:** Always use semantic tokens (`bg.app`, `bg.card`, `bg.glass`, `text.primary`, `text.secondary`, `border.glass`, `brand.icon`, etc.). **Never** hardcode hex colors or use standard colors.
2. **Single Accent:** Use `brand.500` for primary accents, hover highlights, and selections. Do not use per-tab accent colors.
3. **Apple HIG Aesthetics:**
   - Cards/dialogs: `3xl` border-radius (`14px` / `18px`), `bg.card` background, `border.glass` border, and `backdrop-filter: blur(12px)`.
   - Fonts: Native SF system stack (no Google or web font imports).
   - Separators: Hairline thin dividers (`rgba(60, 60, 67, 0.18)`), never thick black borders.
   - Corners: Controls `xl`, badges `lg`, no sharp square edges.
4. **Layout Pattern:** Senders and Storage views must follow a **Two-Pane Master-Detail** layout (left filter panel: `GridItem md=4 lg=3`, right tables/detail: `GridItem md=8 lg=9`).
5. **Non-blocking UX:** Always use loaders (`EmailLoader`, circular progress) for background tasks, and keep table selections highlighted without background color shifts.

---

## ⚙️ Build & Verification Checklist

Before finalizing any task, ensure that:
1. **Tests Pass:** Run the automated unit tests:
   ```bash
   npm test -w server
   ```
2. **TypeScript & React Build:** Ensure compilation is clean:
   ```bash
   npm run build -w client
   ```
3. **Database Checks:** Run the inspection CLI to check for database sanity:
   ```bash
   npm run db:inspect -w server
   ```
