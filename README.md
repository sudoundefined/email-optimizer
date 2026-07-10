# EmailDiet ✨

A high-performance **multi-user web application** for cleaning up your Gmail inbox — scan for marketing clutter, bulk unsubscribe, auto-label senders, protect important contacts, and reclaim gigabytes of storage safely.

> **Privacy & Security First:** Built with full multi-user account isolation backed by SQLite (`WAL` concurrency), HTTP-only JWT session cookies, NIST SP 800-38D compliant **AES-256-GCM** token encryption at rest, rate limiting, and zero email body storage. Nothing is permanently deleted — Gmail Trash acts as your 30-day safety net.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| **SaaS Landing Page** | Eye-catching, responsive landing page with interactive feature highlights, trust signals, and Google OAuth sign-in. |
| **Multi-User Isolation** | Secure multi-user login via Google OAuth 2.0. Every scan, label, unsubscribe, and background job is strictly isolated to your user account (`req.userId`). |
| **Bulk One-Click Unsubscribe** | Detects standard RFC 8058 one-click headers and executes background unsubscribe POST requests or generates clean unsubscribe emails. |
| **Smart Storage Reclaimer** | Reclaim gigabytes of Google Drive storage. Drill down by sender, year, month, or size band (>10 MB attachments) and trash large old emails. |
| **Keep-Latest Retention Engine** | Automatically keep only the $N$ newest emails from high-volume senders (e.g. keep 5 newest shipping updates) and clean out the rest. |
| **Automated Categorization** | Automatically tags newsletters, receipts, bills, and subscriptions into neat UI categories. |
| **Protected Senders List** | Banks, utilities, medical, and government senders are automatically protected via domain/subject heuristics to prevent accidental unsubscribing or deletion. |
| **User Profile & Preferences** | Manage default scan time ranges (`3m`, `6m`, `1y`), message caps (`SCAN_MAX_MESSAGES`), label prefixes (`Unsub/`), and review activity audit logs. |
| **Dark & Light Themes** | Seamlessly toggle between curated Botanical Forest and Espresso themes with full Chakra UI dark mode support. |

---

## 🛡️ Security & Architecture

- **Session Security**: Signed JWT session cookies (`auth_token`) with `HttpOnly`, `SameSite=Lax`, and configurable domain/secure attributes.
- **At-Rest Token Encryption**: Google OAuth access and refresh tokens are encrypted in SQLite using **AES-256-GCM** with NIST-recommended 12-byte (96-bit) IVs and 16-byte authentication tags.
- **Rate Limiting**: Built-in per-user / per-IP rate limiting (120 req/min general API, 15 req/5m heavy scan/unsubscribe operations) via `express-rate-limit`.
- **Database Layer**: High-concurrency SQLite database (`emaildiet.db`) in Write-Ahead Log (`WAL`) mode with foreign key cascade isolation.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Chakra UI v2, Framer Motion |
| **Backend** | Node.js, Express, Google Gmail API (`googleapis`), `better-sqlite3`, `jsonwebtoken` |
| **Database** | SQLite (`better-sqlite3`) with WAL journal mode |

---

## ⚙️ Quickstart & Setup

### 1. Requirements
- Node.js 18+ and npm
- Google Cloud Console OAuth 2.0 Web Client credentials

### 2. Environment Configuration
Copy the example environment file and configure your Google credentials and encryption keys:
```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
PORT=3001
REDIRECT_URI=http://localhost:3001/api/auth/callback
CLIENT_URL=http://localhost:5173

# Security Secrets
JWT_SECRET=your_long_random_jwt_secret_32_chars
TOKEN_ENCRYPTION_KEY=your_64_character_hex_key_for_aes_256_gcm
```

### 3. Running Locally
Install dependencies across client and server:
```bash
npm install
```

Start the full stack development environment:
```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API & OAuth**: `http://localhost:3001`

---

## 🧪 Testing & Verification

Run the complete backend automated unit test suite (105 unit tests across 11 suites):
```bash
npm test -w server
```

Build the production frontend bundle:
```bash
npm run build -w client
```

---

## 📄 License
MIT License. &copy; EmailDiet.
