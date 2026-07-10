# EmailDiet ✨

A high-performance, multi-user SaaS web application for cleaning up and optimizing your Gmail inbox. Scan for subscription clutter, bulk unsubscribe, organize with custom labels, protect important senders, analyze storage, and export data safely and instantly.

> [!IMPORTANT]
> **Privacy & Security First:** Built with full multi-user tenant isolation backed by SQLite in high-concurrency WAL mode, HTTP-only JWT session cookies, NIST SP 800-38D compliant **AES-256-GCM** OAuth token encryption at rest, per-user API rate limiting, and zero email body storage. Nothing is permanently deleted — Gmail Trash acts as your 30-day safety net.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **SaaS Landing Page** | Eye-catching, responsive landing page with interactive feature highlights, trust signals, and Google OAuth sign-in. |
| **Multi-User Tenant Isolation** | Secure login via Google OAuth 2.0. Every scan, label, unsubscribe, and background job is strictly isolated to your user account via SQLite foreign keys. |
| **Smart Subscription Scanner** | Groups promotional emails by sender, detecting the best unsubscribe method and classifying senders into 18 categories. |
| **Bulk One-Click Unsubscribe** | Detects RFC 8058 one-click headers to issue server-side POST requests, sends mailto emails, or returns unsubscribe links. |
| **Protected Senders List** | Automatically shields banks, utilities, medical, and government senders from accidental unsubscribe or deletion using smart heuristics. |
| **Keep-Latest Retention Engine** | Automatically keeps only the $N$ newest emails from high-volume senders (e.g. keep the 5 newest shipping updates) and trashes the rest. |
| **Smart Storage Reclaimer** | Reclaim gigabytes of Google Drive storage. Drill down by sender, year, month, or size band (>5MB attachments) and batch trash old emails. |
| **Weekly Digest Email** | Scheduled cron job that scans for new senders over the week and sends a clean summary report to the user's inbox. |
| **Excel Export** | Instant client-side Excel download (`.xlsx` file) of filtered or selected senders, complete with split first/last name columns and domain names. |
| **Dark & Light Themes** | Toggle between curated, premium *Botanical Forest* and *Espresso* themes with full dark mode support. |

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 6, TypeScript, Chakra UI v2, Framer Motion, SheetJS (`xlsx`) |
| **Backend** | Node.js (ESM), Express, Google Gmail API (`googleapis`), `better-sqlite3`, `jsonwebtoken`, `express-rate-limit` |
| **Database** | SQLite (`better-sqlite3`) in Write-Ahead Log (`WAL`) mode with foreign key constraints |

---

## ⚙️ Quickstart & Setup

### 1. Requirements
- Node.js 18+ and npm
- Google Cloud Console OAuth 2.0 Web Client credentials (with `userinfo.profile`, `userinfo.email`, `gmail.modify`, and `gmail.send` scopes)

### 2. Environment Configuration
Copy the example environment file and configure your credentials:
```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
PORT=3001
HOST=127.0.0.1
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:3001/api/auth/callback
CLIENT_URL=http://localhost:5173

# Security Secrets
JWT_SECRET=your_long_random_jwt_secret_64_characters_hex
TOKEN_ENCRYPTION_KEY=your_64_character_hex_key_for_aes_256_gcm
```

### 3. Running Locally
Install dependencies across the monorepo:
```bash
npm install
```

Start the concurrent development environment (starts Express on `:3001` and Vite on `:5173`):
```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API & OAuth**: `http://localhost:3001`

---

## 🧪 Testing & Verification

Run the full automated backend unit test suite (105 tests, 11 suites):
```bash
npm test -w server
```

Build the production frontend bundle:
```bash
npm run build -w client
```

Inspect SQLite database tables, row counts, and sample records:
```bash
npm run db:inspect -w server
```

---

## 📖 System Documentation

For detailed guides and architecture references, please consult:
- 🏗️ **[ARCHITECTURE.md](file:///c:/Users/deepa/email-unsubscriber/ARCHITECTURE.md)** — Core HLD, LLD (both client and server), database schema, security model, and API endpoints.
- 📋 **[FEATURES.md](file:///c:/Users/deepa/email-unsubscriber/FEATURES.md)** — Extensive feature guides, safety models, release status, and development roadmap.
- 🔐 **[CLAUDE.md](file:///c:/Users/deepa/email-unsubscriber/CLAUDE.md)** — Developer onboarding guide with command reference, project structures, and core patterns.

---

## 📄 License
MIT License. &copy; 2026 EmailDiet.
