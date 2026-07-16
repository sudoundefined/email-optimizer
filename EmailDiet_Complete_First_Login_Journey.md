# EmailDiet --- Complete First Login Journey

> Product Specification Version: 1.0

# Goal

The first-time experience should **build trust, create excitement, and
demonstrate value** before exposing the dashboard.

**Objectives** - Build trust in privacy - Configure scan preferences -
Show progress during analysis - Reveal meaningful insights - Encourage
the first cleanup - Transition users into the dashboard confidently

------------------------------------------------------------------------

# User Journey

``` text
Google OAuth
    │
Permission Verification
    │
Welcome
    │
Privacy & Safety
    │
Scan Configuration
    │
Mailbox Scan
    │
Live Statistics
    │
Mailbox Story
    │
First Cleanup
    │
Empty Inbox Check
    │
Dashboard
```

------------------------------------------------------------------------

# Screen 1 --- Welcome

## Purpose

Create excitement and explain the value.

### Content

-   EmailDiet logo
-   Hero illustration (mailbox + Gmail envelope)
-   Headline: **Welcome to EmailDiet 👋**
-   Supporting copy: "Let's understand your mailbox before we start
    cleaning."
-   Estimated duration: **1--2 minutes**
-   CTA: **Start Analysis**
-   Footer:
    -   Secure
    -   Private
    -   Under your control

### Animation

-   Floating icons
-   Soft glow behind mailbox
-   CTA pulse on hover
-   Fade-in sequence (300ms stagger)

### Success

User clicks **Start Analysis**.

------------------------------------------------------------------------

# Screen 2 --- Privacy & Safety

## Purpose

Reduce anxiety and build trust.

### Content

-   Shield illustration
-   Bullet points:
    -   We only analyze metadata
    -   Email bodies are never read
    -   Nothing is permanently deleted
    -   Everything stays in your Gmail
    -   You stay in control
-   Google OAuth badge
-   CTA: Continue

### Optional

Expandable "How it works" section.

------------------------------------------------------------------------

# Screen 3 --- Scan Configuration

## Purpose

Collect scan preferences.

### Options

### Time Range

-   Last Month
-   Last 3 Months
-   Last 6 Months (default)
-   All Time

### Maximum Emails

-   1,000
-   2,500
-   5,000
-   Unlimited

### Protect Important Senders

-   Banking
-   Government
-   Work
-   Family
-   Starred

CTA: **Start Scan**

Validation: - At least one protected category selected (recommended, not
mandatory).

------------------------------------------------------------------------

# Screen 4 --- Scanning Experience

## Purpose

Keep users engaged.

### Layout

Large circular progress.

Checklist - Connecting to Gmail - Fetching metadata - Discovering
senders - Analyzing attachments - Detecting subscriptions - Calculating
mailbox health

Footer note: "You can safely close this window. We'll notify you when
the scan completes."

### Motion

-   Animated progress ring
-   Live checklist updates
-   Count-up numbers

------------------------------------------------------------------------

# Screen 5 --- Live Statistics

## Purpose

Show progress while scanning.

Cards: - Emails Scanned - Senders Discovered - Subscriptions Found -
Potential Storage Recovery

Live updates every few seconds.

Bottom progress message: "Almost there! We're crunching the numbers."

------------------------------------------------------------------------

# Screen 6 --- Mailbox Story

## Purpose

Present findings as a narrative.

Headline: **Analysis Complete! 🎉**

Story: - You received **18,428 emails** - From **642 people** - **72%**
came from **11 senders** - You can safely clean **2,843 emails** -
Potential storage recovery **4.8 GB** - Estimated cleanup time **6
minutes**

CTA: **Show My Dashboard**

Design: Large illustration + insight cards.

------------------------------------------------------------------------

# Screen 7 --- First Cleanup Celebration

Displayed after the user's first cleanup.

### Celebrate

-   Confetti
-   Success icon
-   Health score animation

Metrics - Emails cleaned - Storage recovered - Health improvement - Time
saved

CTA: **Continue to Dashboard**

------------------------------------------------------------------------

# Screen 8 --- Empty Inbox State

Displayed when no cleanup is required.

Headline: "Amazing! Your mailbox looks great."

Show: - Health Score - Friendly illustration - Message: "No cleanup
needed today. We'll notify you when new opportunities appear."

CTA: Go to Dashboard

------------------------------------------------------------------------

# Screen 9 --- Dashboard

This is the user's first full product experience.

## Hero

Greeting: "Good evening, `<User>`{=html} 👋"

Mailbox Health Today's Priorities Weekly Progress

## Sections

-   Mailbox Health
-   Today's Priorities
-   Quick Wins
-   Mailbox DNA
-   Top Senders
-   Storage Overview
-   Time Saved
-   Today's Insight
-   Recent Activity

------------------------------------------------------------------------

# UX Principles

-   Never overwhelm the user.
-   Explain before asking for action.
-   Show progress continuously.
-   Celebrate meaningful milestones.
-   Use deterministic insights instead of vague AI claims.

------------------------------------------------------------------------

# Motion Guidelines

  Element              Motion
  -------------------- -----------------------------
  Screen transitions   Fade + slight upward motion
  Progress ring        Continuous sweep
  Metrics              Count-up
  Cards                Fade + stagger
  Success              Confetti + spring
  CTA                  Gentle hover scale

------------------------------------------------------------------------

# Edge Cases

## Scan fails

-   Explain reason
-   Retry button
-   Contact support

## Permission revoked

-   Reconnect Google

## No emails found

-   Friendly empty state

## API quota exceeded

-   Pause and retry later

------------------------------------------------------------------------

# Success Metrics

-   Onboarding completion rate
-   Time to first scan
-   Time to first cleanup
-   First cleanup conversion
-   Dashboard visit rate
-   Day-7 retention

------------------------------------------------------------------------

# Acceptance Criteria

-   First scan completes without confusion.
-   User understands privacy model.
-   Dashboard feels earned after analysis.
-   Every screen has one primary action.
-   Experience is under two minutes for most users.
