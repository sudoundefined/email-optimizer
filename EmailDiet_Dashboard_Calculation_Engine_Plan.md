# EmailDiet Dashboard Calculation & Scoring Engine

**Version:** 1.0

## Purpose
The EmailDiet dashboard should not display raw Gmail statistics. Every widget should answer:
> What should the user do next, and why?

The dashboard is powered by a deterministic Scoring & Insights Engine.

---

# Architecture

```text
Gmail API
    │
Metadata Scanner
    │
Normalization Engine
    │
Rule Engine
    │
Scoring Engine
    │
Insights Engine
    │
Dashboard JSON API
    │
React Dashboard
```

# Metadata Required

- Sender
- Sender Domain
- Subject
- Internal Date
- Gmail Category
- Labels
- Read/Unread
- Starred
- Important
- Attachment Count
- Attachment Size
- Thread ID
- Message Size
- Archive Status
- Trash Status

# Mailbox Health Score

| Component | Weight |
|-----------|---------|
| Inbox Cleanliness | 20% |
| Readability | 15% |
| Organization | 15% |
| Storage Efficiency | 15% |
| Protected Senders | 10% |
| Subscription Hygiene | 15% |
| Cleanup Activity | 10% |

Formula

```
Health =
(Cleanliness × .20)
+ (Readability × .15)
+ (Organization × .15)
+ (Storage × .15)
+ (SenderTrust × .10)
+ (Subscription × .15)
+ (Cleanup × .10)
```

Clamp between 0 and 100.

Health Levels

- 90-100 Excellent
- 75-89 Good
- 60-74 Fair
- Below 60 Needs Attention

# Today's Priorities

Impact Score

```
(Storage Saved × 0.40)
+ (Email Count × 0.30)
+ (Inactive Days × 0.20)
+ (Interaction Weight × 0.10)
```

Display Top 5 opportunities.

# Promotional Emails

Includes

- Promotions category
- Marketing senders
- Promotional labels

High Impact if

- Storage >500MB
- OR Email Count >100

# Estimated Cleanup Time

Average speed = 40 emails/min

Cleanup Time = Emails / 40

# Storage Recovery

Potential recovery from

- Large attachments
- Old newsletters
- Duplicate emails
- Large messages

# Large Attachment Rule

Attachment >5MB (configurable)

# Mailbox DNA

Category % = Category Emails / Total Emails

Possible identities

- Shopping Heavy
- Finance Focused
- Professional
- Student
- Creator
- Travel Heavy

# Top Senders

Rank using

Email Count + Recent Activity Weight

# Weekly Progress

Track

- Emails Removed
- Storage Saved
- Labels Created
- Protected Senders
- Unsubscribed Senders

# Cleanup Streak

Increase every day user performs cleanup.

Reset if skipped.

# Time Saved

Assumption

4 seconds per deleted email

Convert to minutes, hours and work days.

# Daily Insight Engine

Examples

Shopping >45%

→ Shopping dominates your inbox.

Unread >500

→ You have over 500 unread emails older than 30 days.

# Forecast

Growth = New Emails − Deleted Emails

Forecast30 = Growth × 30

Predict

- Inbox growth
- Storage usage
- Email volume

# Cleanup Potential

Based on

- Promotions
- Newsletters
- Attachments
- Duplicates

Weights

- Storage 40%
- Email Count 30%
- Unused 20%
- Duplicates 10%

# Sender Priority

Priority =
Volume + Storage + Inactivity + Open Rate

Open Rate = Opened / Received

# Organization Score

Uses

- Label Coverage
- Archive Ratio
- Protected Coverage

# Security Score

Protected Important Senders / Important Senders

# Duplicate Detection

Rules

- Same Subject
- Similar Sender
- Frequency
- Thread Relationship

# Cleanup Queue

Priority =
Impact × Storage × Confidence

# Achievement System

- First Cleanup
- 1K Club
- Storage Saver
- Newsletter Ninja
- Inbox Hero
- 7-Day Streak
- Label Master

# Refresh Strategy

| Widget | Refresh |
|--------|---------|
| Health | After Scan |
| Priorities | After Scan |
| DNA | After Scan |
| Storage | After Scan |
| Forecast | Daily |
| Weekly Progress | Daily |
| Time Saved | After Cleanup |

# Backend Recommendation

Create a dedicated Insights & Scoring Service.

Responsibilities

- Normalize metadata
- Calculate scores
- Generate dashboard JSON
- Cache calculations
- Explain every score

# Future Improvements

- Historical trends
- User configurable scoring
- Explainability panel
- Export dashboard metrics
- Scheduled recalculation
- Comparison with previous months

# Acceptance Criteria

- Every score has a formula.
- No AI required.
- Fully deterministic.
- Explainable insights.
- Consistent refresh after scans.
