# Apni Library Result Alert Engine

Production-ready MVP plan/code for GitHub + Vercel.

Important:
- All JS/JSX files are saved with `.txt` extension as requested.
- Before deploying on Vercel, rename these files:
  - `.txt` → `.js`
  - `.jsx.txt` → `.jsx`
- Keep `package.json`, `.env.example`, and README files as normal.

This software only monitors public official university result pages and checks results for registered roll numbers after the official portal is live. It does not access private/admin APIs, bypass CAPTCHA, brute-force roll numbers, or access unpublished data.

## Deploy steps

1. Create GitHub repo.
2. Copy these files into repo.
3. Rename JS/JSX `.txt` files to real extensions.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Add Vercel environment variables from `.env.example`.
6. Deploy to Vercel.
7. Add cron-job.org jobs:
   - `/api/discover-result-portal?secret=CRON_SECRET` every 5 minutes
   - `/api/result-monitor?secret=CRON_SECRET` every 5 minutes
   - `/api/probe-result-form?secret=CRON_SECRET` every 5 minutes
   - `/api/process-result-queue?secret=CRON_SECRET` every 5 minutes initially

## First test order

1. Open `/admin/result-alert?admin=ADMIN_SECRET`
2. Send Telegram test.
3. Register a test roll number from `/result-alert`
4. Run discovery manually.
5. If 2025-26 portal is not live yet, manually set old 2024-25 portal in Firestore for testing.
6. Use admin manual test with an already-live 2024-25 valid roll number.
7. Test fake roll number and confirm it becomes `not_found`.
