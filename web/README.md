# Marathon Group CRM Dashboard

Next.js dashboard over the Marathon pipeline's Neon Postgres database.
Dark navy "operator's cockpit" theme (IBM Plex Sans/Mono, electric blue
accents) implemented from the Claude Design handoff.

## Pages

- `/` — dashboard home: Today's Brief (the morning-brief agent's daily
  write-up), stat cards, pending email drafts with inline **Approve** /
  **Edit**, recent signals, and the agent-run activity feed.
- `/pipeline` — kanban board of all deals; drag cards between stages.
- `/queue` — approval flow for pending drafts (edit → approve / regenerate / skip).
- `/signals` — trigger events the news agent found (capital projects,
  funding, expansions, acquisitions, leadership changes).
- `/activity` — full audit trail: deal activities interleaved with agent runs.
- `/companies`, `/contacts` — directory CRUD.
- `/runs` — agent run history + manual pipeline trigger.
- `/deal/[id]` — full deal detail with draft editor, Approve, and Send.

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
3. Deploy. No other configuration is needed — the app talks to Neon through
   `@neondatabase/serverless` (SQL over HTTPS), Neon's recommended driver for
   Vercel serverless. It also avoids raw-TCP egress restrictions in
   sandboxed/CI environments.
