# Marathon Group CRM — User Guide

*Written for Michael. Ten minutes a day, coffee in hand.*

## What this system does while you sleep

Every weekday morning around 7 AM ET, your agents run:

1. **Prospector** finds new prospects matching your ideal client profile and
   adds them to the pipeline.
2. **Qualifier** scores each new prospect 1–10 against your ICP — who's worth
   your time.
3. **Signal Scanner** reads news, filings, and announcements for trigger
   events — bond approvals, capital projects, new hires, expansions — the
   "why now" behind a good outreach email.
4. **Draft Writer** writes outreach emails in your voice for qualified
   prospects and campaign follow-ups. **Nothing is ever sent without your
   approval.**
5. **Morning Brief** summarizes all of it into the card at the top of your
   dashboard.

## Your 10-minute daily loop

1. **Open the Dashboard** (the home page). Read **Today's Brief** — it tells
   you what happened overnight and what to do first.
2. **Work the Pending Email Drafts list.** Each card shows who the email is
   to, their title and company, and the subject line.
   - **Approve** — one click; the draft is marked ready to send.
   - **Edit** — opens the full email so you can adjust wording before
     approving. Your edits are what gets approved.
3. **Scan Recent Signals.** These are live reasons to reach out. If a signal
   is hot, the matching draft is usually already in your queue.
4. Done. That's the whole job — the agents handle the rest.

## The pages

| Page | What it's for |
|---|---|
| **Dashboard** | Morning brief, key numbers, drafts to approve, fresh signals |
| **Pipeline** | Every deal as a card — drag between stages (New → Qualified → Contacted → Replied → Meeting set → Won/Lost) |
| **Approval Queue** | Focused one-at-a-time review: edit → approve → next. Also **Regenerate** if a draft misses the mark |
| **Signals** | Every trigger event found, with a link to the source article |
| **Activity** | Plain-English feed of everything the system did, newest first |
| **Companies / Contacts** | Your directory — add or edit anyone manually |
| **Runs** | Technical log of agent runs, plus a button to trigger a run manually |

## Sending an approved email

Open the deal (click **Edit** on a draft, or any card on the Pipeline board)
and hit **Send**. Today that marks the email sent and opens it pre-filled in
your mail program — you press send there. This keeps you in control of every
send while the system tracks the sequence.

## When someone replies

Drag their card to **Replied** on the Pipeline board (or change the stage on
the deal page). That stops the follow-up sequence for them immediately and
flags them for your personal attention.

## The 26-week campaign

A prospect who doesn't reply gets a fresh-angle follow-up drafted roughly
every 7 days after the last send, for up to 26 weeks. Every follow-up lands
in your approval queue like any other draft — the system never sends on its
own.

## FAQ

**Where does the email voice come from?** Three files the agents read every
time: your voice guide, mission context, and the campaign framework. Want the
tone adjusted? Those files are the dial.

**A draft has the wrong tone or facts.** Hit **Regenerate** in the Approval
Queue — the writer takes a fresh pass. Every draft also passes an automatic
voice check (banned phrases, first-name greeting, correct signature) before
it reaches you.

**Can I add a prospect myself?** Yes — **New deal** on the Pipeline board, or
add the company/contact in the directory first.

**What if I skip a few days?** Nothing sends without you. Drafts simply
accumulate in the queue.

## For whoever maintains this

- Deployed on Vercel; data in Neon Postgres. Env vars: `DATABASE_URL`,
  `DASHBOARD_PASSWORD`, `ANTHROPIC_API_KEY`, `SENDER_PHONE`,
  `SENDER_WEBSITE`, optional `RESEND_API_KEY`/`DIGEST_TO` for the emailed
  digest. Env changes take effect on the next deploy.
- Migrations: `npm run migrate`, `migrate:campaign`, `migrate:signals`,
  `migrate:repair` (all idempotent).
- **Review & refresh drafts** (button on the Runs page) re-checks every
  pending draft against the voice guide and rewrites only the failures —
  use it after any voice/signature change. `npm run drafts:regenerate` is
  the CLI twin.
