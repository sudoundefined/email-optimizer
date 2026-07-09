# Google OAuth Production Verification

The scheduled weekly digest needs the app to hold a **long-lived** Google sign-in.
In **Testing** mode, Google expires refresh tokens after ~7 days, so a weekly cron
will silently stop working until you sign in again. Moving the OAuth app to
**Production** (verified) removes that limit.

This guide covers what's already in place and the steps to submit.

---

## What this repo already provides

- **Privacy Policy** — served at `/{host}/legal/privacy`
- **Terms of Service** — served at `/{host}/legal/terms`
- Both are plain, unauthenticated HTML pages (see `server/src/routes/legal.js`) so
  they have stable public URLs you can paste into the OAuth consent screen.
- Set the contact address via the `LEGAL_CONTACT_EMAIL` env var before submitting.

> The verification pages must be reachable at a **public HTTPS URL**. For local dev
> the server runs on `http://localhost:3001`; for submission you need a hosted
> deployment (or a tunnel like Cloudflare Tunnel / ngrok with a stable domain).

---

## Scopes used and why (justification for the consent screen)

| Scope | Why the app needs it |
|-------|----------------------|
| `https://www.googleapis.com/auth/gmail.modify` | Group and analyze mail by reading message metadata (sender, subject, labels, size); move messages to Trash; create/apply/remove `Unsub/*` labels. No permanent deletion is performed. |
| `https://www.googleapis.com/auth/gmail.send` | Send unsubscribe emails (mailto method) and the weekly digest email from the user's own account, on their behalf. |

**Data handling summary (for the questionnaire):** self-hosted; no external database;
tokens and small operational JSON files stored locally; email contents never
persisted; nothing shared with third parties; adheres to the Google API Services
User Data Policy (Limited Use).

---

## Submission steps

1. **Deploy** the app to a public HTTPS host and confirm:
   - `https://YOUR_HOST/legal/privacy` loads
   - `https://YOUR_HOST/legal/terms` loads
   - Set `LEGAL_CONTACT_EMAIL`, and update `REDIRECT_URI` / `CLIENT_URL` in the
     server env to the deployed URLs.
2. In **Google Cloud Console → APIs & Services → OAuth consent screen**:
   - App name, support email, developer contact.
   - **App domain**, **Privacy policy URL**, **Terms of service URL** → the hosted pages above.
   - Add the two scopes and paste the justification text above.
   - Upload an app logo if prompted.
3. **Publish** the app (Testing → Production) and click **Prepare for verification**.
4. Submit. Google may ask for a **demo video** showing the OAuth flow and how each
   scope is used, plus answers to a security questionnaire.
5. Expect **~2–4 weeks**. Until approved, the app keeps working in Testing mode
   (with the 7-day token expiry).

---

## Until verification lands

- The digest scheduler runs whenever the app is up and a valid sign-in exists.
- If the token has expired, scheduled runs fail safely (the job errors, nothing is
  sent, and it retries on the next tick) — just sign in again.
- The digest settings dialog surfaces this caveat to the user.
