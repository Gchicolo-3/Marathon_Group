# Marathon Group CRM Dashboard (v1)

Next.js dashboard over the Marathon pipeline's Neon Postgres database.

## Pages

- `/` — all prospects (name, company, title, score) joined with their latest
  email draft (subject, status), sorted by qualification score descending.
- `/prospect/[id]` — full drafted email in editable fields, with
  **Save draft**, **Approve**, and **Send** buttons. Send is v1: it marks the
  draft `sent` and opens your mail client via a `mailto:` link with the
  approved subject/body pre-filled.

## API

- `GET  /api/prospects` — list prospects + latest draft
- `GET  /api/prospects/[id]` — single prospect + draft
- `PUT  /api/prospects/[id]/draft` — save edited subject/body
- `POST /api/prospects/[id]/approve` — set draft status to `approved`
- `POST /api/prospects/[id]/send` — set status to `sent`, returns `mailto:` link

All pages and API routes sit behind a shared-password gate
(`DASHBOARD_PASSWORD`); `/login` sets an httpOnly session cookie.

## Local development

```bash
cd web
cp .env.example .env   # fill in DATABASE_URL (Neon) and DASHBOARD_PASSWORD
npm install
npm run introspect     # sanity-check the live schema + data
npm run dev            # http://localhost:3000
```

## Deploy to Vercel

1. Import the repo in Vercel and set **Root Directory** to `web/`.
2. Add environment variables (Production + Preview):
   - `DATABASE_URL` — the same Neon connection string the pipeline uses
     (include `sslmode=require`).
   - `DASHBOARD_PASSWORD` — the shared dashboard password.
3. Deploy. No other configuration is needed — the app uses the Node runtime
   with a small `pg` pool, which works on Vercel serverless with Neon.
