# Frontend Implementation Plan & TODOs

> [!NOTE]
> This file tracks deferred frontend tasks. Do not execute these tasks during the backend implementation phase.

---

## 1. First Login Onboarding Journey UI Components (`client/src/components/onboarding/`)

### [TODO] Create Onboarding Container (`client/src/components/onboarding/OnboardingModal.tsx`)
- Intercept user on login if `user.onboarding?.isCompleted === false`.
- Render wizard steps (`welcome` → `privacy` → `config` → `scanning` → `story` → `celebration` / `empty`).

### [TODO] Screen 1: Welcome (`Welcome.tsx`)
- Hero illustration + headline: *"Welcome to EmailDiet 👋"*.
- Supporting copy: *"Let's understand your mailbox before we start cleaning."*
- Estimated duration: **1–2 minutes**.
- CTA: **Start Analysis** (`PATCH /api/user/onboarding` step: `'privacy'`).

### [TODO] Screen 2: Privacy & Safety (`Privacy.tsx`)
- Shield illustration + security bullet points (only metadata analyzed, zero email body storage, safe TRASH defaults).
- CTA: **Continue** (`PATCH /api/user/onboarding` step: `'config'`).

### [TODO] Screen 3: Scan Configuration (`ScanConfig.tsx`)
- Selectors for `Time Range` (`1m`, `3m`, `6m` default, `all`).
- Selectors for `Maximum Emails` (`1000`, `2500`, `5000`, `Unlimited`).
- Multi-select pills for `Protect Important Senders` (`Banking`, `Government`, `Work`, `Family`, `Starred`).
- CTA: **Start Scan** (`POST /api/user/onboarding/configure` + triggering circular scanning view).

### [TODO] Screen 4 & 5: Scanning Experience & Live Statistics (`ScanningView.tsx`)
- Large circular progress sweep.
- Live checklist (Connecting to Gmail → Fetching metadata → Discovering senders → Analyzing attachments → Calculating health).
- Live counter cards updating during scan (`Emails Scanned`, `Senders Discovered`, `Subscriptions Found`, `Potential Storage Recovery`).

### [TODO] Screen 6: Mailbox Story (`MailboxStory.tsx`)
- Fetches `GET /api/insights/story`.
- Narrative cards:
  - *"You received **{totalEmails}** emails from **{senderCount}** people"*
  - *"**{topConcentration.percentage}%** came from **{topConcentration.senderCount}** senders"*
  - *"You can safely clean **{cleanupPotential.messages}** emails (**{cleanupPotential.storageGB} GB** potential recovery)"*
  - *"Estimated cleanup time: **{estimatedMinutes} minutes**"*
- CTA: **Show My Dashboard** or **Start First Cleanup**.

### [TODO] Screen 7 & 8: Celebration & Empty Inbox States (`CelebrationModal.tsx` / `EmptyState.tsx`)
- Screen 7: Confetti, count-up animation (`emails cleaned`, `storage recovered`, `health improvement`). CTA: **Continue to Dashboard** (`POST /api/user/onboarding/complete`).
- Screen 8: Displayed when `isClean === true`. CTA: **Go to Dashboard**.

---

## 2. Deterministic Scoring & Insights Dashboard UI (`client/src/components/DashboardTab.tsx`)

### [TODO] Upgrade Dashboard Tab to 14+ Deterministic Widgets
Consume `GET /api/insights/dashboard` (`DashboardInsightsResponse`) and render master-detail widgets where every card displays:
1. **Mailbox Health Score Ring**: Score 0–100, `Health Level` badge (`Excellent`, `Good`, `Fair`, `Needs Attention`), and 7-part weight breakdown tooltip.
2. **Today's Priorities (Top 5 Opportunities)**: Impact-ranked opportunity cards with deterministic `why` explanation string and direct **Action Button** (`{ action.label }`) triggering filter/cleanup.
3. **Mailbox DNA Identity**: Dominant identity card (`Shopping Heavy`, `Finance Focused`, `Professional`, `Student`, `Creator`, `Travel Heavy`) with category percentage progress bars.
4. **Promotional Alert Card**: Alert banner triggered if promotions `Storage > 500MB` OR `Count > 100`.
5. **Storage Recovery & Attachment Breakdown**: Bar chart showing potential recovery across `Large Attachments (>5MB)`, `Newsletters`, `Duplicates`, `Large Messages`.
6. **Estimated Cleanup Time & Time Saved**: Counter card converting `(deleted * 4s)` into `minutes`, `hours`, and `work days`.
7. **Weekly Progress & Cleanup Streak**: Consecutive calendar days streak flame icon (`{streak} Day Streak`) + 7-day progress counters.
8. **30-Day Forecast**: Growth prediction (`New - Deleted * 30`).
9. **Achievement Badges Grid**: 7 badges (`First Cleanup`, `1K Club`, `Storage Saver`, `Newsletter Ninja`, `Inbox Hero`, `7-Day Streak`, `Label Master`) showing unlocked state (`progress / maxProgress`).

---

## 3. Frontend Account Switcher UX (`client/src/components/`)

### [TODO] Account Switcher Dropdown & Multi-Account State
- Maintain active account selection (`activeAccountId`) in `api.ts` / `useAuth.ts`.
- Topbar dropdown displaying current account email + avatar (`[Avatar] user@gmail.com ▼`).
- List all connected accounts with checkmarks, plus `+ Connect Another Gmail Account` and `Disconnect Account` options.

---

## Frontend Verification Plan
- Run `npm test -w client` (`vitest`).
- Run `npm run build -w client` (`tsc -b` + Vite build).
