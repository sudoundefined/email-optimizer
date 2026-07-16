# EmailDiet — Complete API & Swagger / OpenAPI Documentation

All API endpoints of the **EmailDiet Multi-User SaaS Engine** are fully documented below and serialized in an industry-standard **OpenAPI 3.0.3 Specification** located at [`server/openapi.yaml`](./server/openapi.yaml). You can import `openapi.yaml` directly into **Swagger UI**, **Postman**, **Insomnia**, or **Redoc** for independent client generation and interactive testing.

---

## 🔐 Authentication & User Isolation (`userId`)

All protected API endpoints require:
1. **HTTP-only JWT Session Cookie**: Set automatically by `GET /api/auth/callback` after Google OAuth or `POST /api/auth/demo-login` (`auth_token` / `oauth_state`). The JWT encodes `{ sub: userId }`.
2. **Strict User Isolation (`userId`)**: Every query and database mutation is scoped strictly to the authenticated user ID (`req.userId` extracted from the JWT cookie). The application adheres to a clean 1:1 user/account model (`users` table); there is no multi-account switcher or `X-Account-Id` header needed.
3. **CSRF Protection**: All mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) verify `Origin` or `Referer` against allowed origins (`config.corsOrigin`, `config.clientUrl`).

---

## ⚡ Rate Limiting & Safety Invariants

- **Global Rate Limiter**: 100 requests per 15 minutes per IP.
- **User API Rate Limiter**: 60 requests per minute (`config.rateLimitPerMinute`) per authenticated account.
- **Non-Destructive Invariant**: All cleanup operations (`senders/trash`, `messages/trash`, `senders/keep-latest`, `inbox/filter/:key/trash`) strictly move messages to the **Gmail TRASH label** (`recoverable for 30 days`).
- **Single Exception**: `DELETE /api/messages/trash` (Empty Trash) is the sole permanent deletion endpoint, requiring explicit confirmation and strictly scoped to `in:trash`.

---

## 📚 Endpoint Catalog

### 1. Public & Legal
| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/health` | Health check (`{ ok: true }`) | No |
| `GET` | `/legal/privacy` | Public Privacy Policy HTML | No |
| `GET` | `/legal/terms` | Public Terms of Service HTML | No |

### 2. Authentication (`/api/auth`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/auth/status` | Returns session status (`connected`) and current `user` profile details. |
| `GET` | `/api/auth/login` | Redirects to Google OAuth consent screen with encrypted state. |
| `POST` | `/api/auth/demo-login` | **Sandbox Mode**: Issues demo session (`auth_token`) and populates mock dataset (`demo_user`). |
| `POST` | `/api/auth/logout` | Revokes OAuth token from DB and clears session cookie. |

### 3. User & Preferences (`/api/user`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/profile` | Returns account profile details (`messagesTotal`, `historyId`). |
| `GET` | `/api/user/preferences` | Returns account preferences (`defaultTimeRange`, `scanMaxMessages`, `labelPrefix`, `digest*`). |
| `PATCH` | `/api/user/preferences` | Updates account preferences (`{ defaultTimeRange, labelPrefix }`). |
| `GET` | `/api/user/activity` | Returns audit trail entries from `activity_log`. |
| `GET` | `/api/user/gamification` | Computes gamification stats (`hoursSaved`, `co2ReducedKg`). |

### 4. Mailbox Scans & Senders (`/api`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/scan` | Initiates background mailbox metadata scan (`{ range: "6m" }`). Returns `{ jobId }`. |
| `GET` | `/api/senders` | Returns cached sender scan aggregations (`senders[]`). |
| `GET` | `/api/subscriptions` | Returns detected recurring subscription patterns (`cadence: weekly/monthly`). |
| `POST` | `/api/senders/trash` | Moves all mail from `senderEmails[]` to Trash. Returns `{ jobId, excluded }`. |
| `POST` | `/api/senders/keep-latest` | Retains newest `keepCount` emails per sender and trashes historical clutter. |

### 5. Bulk One-Click Unsubscribe (`/api/unsubscribe`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/unsubscribe` | Executes RFC 8058 one-click unsubscribe or mailto calls for `senderEmails[]`. Returns `{ jobId, excluded }`. |

### 6. Labels & Categorization (`/api/labels`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/labels/suggestions` | Returns AI/heuristic category suggestions (`confidence: high/medium/low`). |
| `POST` | `/api/labels/apply` | Applies category labels to sender assignments (`{ assignments: [{ senderEmail, category }] }`). |
| `POST` | `/api/labels/apply-filter` | Creates Gmail filter & label for query (`{ query: "from:substack.com", labelName: "Newsletters/Substack" }`). |
| `GET` | `/api/labels` | Lists all app-created and system Gmail labels (`messagesTotal`, `messagesUnread`). |
| `DELETE` | `/api/labels/:id` | Deletes app-created Gmail label `:id`. |
| `GET` | `/api/labels/:id/messages` | Returns paginated messages inside label `:id`. |

### 7. Smart Inbox & Groups (`/api/inbox`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/inbox/filters` | Returns pre-built smart queries (`promotions-old`, `large-attachments`). |
| `GET` | `/api/inbox/groups` | Returns category groups (`key`, `title`, `count`, `unread`). |
| `GET` | `/api/inbox/groups/:key/messages` | Lists messages inside group `:key`. |
| `GET` | `/api/inbox/filter?q=query` | Executes arbitrary Gmail search query and returns matching messages. |
| `POST` | `/api/inbox/filter/:key/trash` | Bulk moves messages matching pre-built filter `:key` to Trash. |

### 8. Protection Whitelist (`/api/protect`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/protect` | Lists all whitelisted senders (`reason: auto:domain / manual`). |
| `POST` | `/api/protect` | Adds `emails[]` to protection whitelist (`ON CONFLICT DO NOTHING`). |
| `DELETE` | `/api/protect` | Removes `emails[]` from protection whitelist. |

### 9. Storage Reclamation (`/api/storage`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/storage/stats` | Returns aggregated storage usage by `senders`, `months`, `years`, `sizes`, and top `attachments`. |
| `POST` | `/api/storage/refresh` | Triggers cache refresh job for heavy attachments. |
| `GET` | `/api/storage/messages?sender=...` | Drill-down queries by `sender`, `month`, or `sizeBand`. |

### 10. Message Operations (`/api/messages`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/messages/trash` | Moves specific message `ids[]` to Gmail TRASH. |
| `DELETE` | `/api/messages/trash` | **Empty Trash**: Permanently deletes all messages in Gmail Trash (`batchDelete`). |

### 11. Weekly Digest (`/api/digest`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/digest` | Returns schedule settings (`dayOfWeek`, `hour`), `lastRunAt`, and `history[]`. |
| `POST` | `/api/digest/settings` | Updates weekly digest schedule preferences. |
| `POST` | `/api/digest/run` | Manually triggers weekly digest execution right now. |
| `POST` | `/api/digest/preview` | Generates dry-run preview of what the digest email will look like. |

### 12. Background Jobs (`/api/jobs`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/jobs/:id` | Returns snapshot of background job (`state: running/done/error`, `progress`, `result`). |
| `POST` | `/api/jobs/:id/cancel` | Aborts running background task. |
| `GET` | `/api/jobs/:id/events` | **Server-Sent Events (SSE)** endpoint streaming live `event: progress` updates. |

### 13. System Logs (`/api/logs`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/logs/recent?limit=50` | Returns recent activity logs from `activity_log`. |
| `GET` | `/api/logs/metadata?limit=20` | Returns diagnostic scan timings and profiling history. |
| `POST` | `/api/logs/client` | Forwards client-side console warnings/errors to backend terminal (`{ level, message, context }`). |

### 14. First Login Onboarding (`/api/user/onboarding`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/user/onboarding` | Returns current `OnboardingState` (`step: welcome/privacy/config/scanning/story/celebration/completed`, `isCompleted: boolean`, `shouldStartAtDashboard: boolean`). |
| `PATCH` | `/api/user/onboarding` | Updates the onboarding step (`{ step: "privacy" }`). |
| `POST` | `/api/user/onboarding/configure` | Configures preferences and initiates initial scan (`{ timeRange: "6m", maxMessages: 500, protectedCategories: ["Banking", "Finance"] }`). Returns `{ jobId, status }`. |
| `GET` | `/api/user/onboarding/story` | Returns executive `MailboxStoryResponse` summary of initial scan (`totalEmails`, `totalStorageGB`, `promotionsStorageMB`, `topSenders`, `dominantCategory`, `cleanupPotential`, `isClean`). |
| `POST` | `/api/user/onboarding/complete` | Finalizes onboarding, marks `has_completed_onboarding = 1`, and returns instant `CelebrationPayload` (`emailsCleaned`, `timeSavedMinutes`, `healthImprovement`). |

### 15. Deterministic Insights & Dashboard (`/api/insights`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/insights/dashboard` | Returns precomputed `DashboardInsightsResponse` instantly (`<10ms`) from `ScanCacheRepository` (`dashboard_json`). Includes `scores` (`healthScore: 0-100`, `healthLevel: Excellent/Good/Fair/Needs Attention`, `cleanlinessScore`, `storageEfficiencyScore`, etc.) and 14+ explainable `widgets` with `why` plain-English strings and `action` objects. |
| `GET` | `/api/insights/health` | Drill-down endpoint returning detailed 6-part weighted formula breakdown. |
| `GET` | `/api/insights/priorities` | Returns ranked `topPriorities` opportunities sorted by `messageCount * storageMB` impact score. |
| `GET` | `/api/insights/dna` | Returns Mailbox Identity profile (`Shopping Heavy`, `Newsletter Collector`, `Balanced User`, etc.). |
| `GET` | `/api/insights/achievements` | Returns 7 gamification badges (`first_cleanup`, `inbox_zero_hero`, `storage_saver_100mb`, `storage_saver_1gb`, `unsubscriber_10`, `streak_master`, `security_sentinel`). |
| `POST` | `/api/insights/recalculate` | Manually triggers full deterministic engine recalculation (`normalizationEngine` $\rightarrow$ `scoringEngine` $\rightarrow$ `insightsEngine`) and updates cache. |

---

## 💻 Example cURL Requests

### 1. Check Auth Status & User Profile
```bash
curl -i -X GET http://localhost:3001/api/auth/status \
  -H "Cookie: auth_token=YOUR_JWT_COOKIE"
```

### 2. Enter Sandbox / Demo Mode (Independent Testing)
```bash
curl -i -X POST http://localhost:3001/api/auth/demo-login \
  -H "Content-Type: application/json"
```

### 3. Start a Mailbox Scan
```bash
curl -i -X POST http://localhost:3001/api/scan \
  -H "Cookie: auth_token=YOUR_JWT_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"range": "6m"}'
```

### 4. Bulk Unsubscribe from Senders
```bash
curl -i -X POST http://localhost:3001/api/unsubscribe \
  -H "Cookie: auth_token=YOUR_JWT_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"senderEmails": ["newsletter@substack.com", "promo@target.com"]}'
```

### 5. Stream SSE Background Job Progress
```bash
curl -N -X GET http://localhost:3001/api/jobs/550e8400-e29b-41d4-a716-446655440000/events \
  -H "Cookie: auth_token=YOUR_JWT_COOKIE"
```

### 6. Retrieve Precomputed Deterministic Dashboard Insights (<10ms)
```bash
curl -i -X GET http://localhost:3001/api/insights/dashboard \
  -H "Cookie: auth_token=YOUR_JWT_COOKIE"
```

### 7. Retrieve First Login Mailbox Story Summary
```bash
curl -i -X GET http://localhost:3001/api/user/onboarding/story \
  -H "Cookie: auth_token=YOUR_JWT_COOKIE"
```

---

## 🚨 Error Responses & Troubleshooting

| HTTP Status | Error Code | Example Response | Explanation |
| :---: | :--- | :--- | :--- |
| `401` | `not_connected` | `{"error": "not_connected", "message": "Google token revoked"}` | The OAuth token is missing, expired, or was revoked in Google account settings. Re-auth or use `/demo-login`. |
| `403` | `CSRF check failed` | `{"error": "CSRF Origin check failed"}` | Mutating request (`POST/PUT/DELETE`) sent from an unauthorized origin domain. Check `CORS_ORIGIN`. |
| `429` | `Rate limit exceeded` | `{"error": "Rate limit exceeded. Try again later."}` | Account exceeded 60 requests/minute or global IP limit reached. |
| `500` | `internal_error` | `{"error": "Database query failed"}` | Unhandled server or Postgres query error. Check backend terminal logs (`/api/logs/client`). |
