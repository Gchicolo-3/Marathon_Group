# Phase two go live (Marathon instance)

What this branch adds: contact verification (Vibe), the approve gate,
scoring v2 with the four gates, sourced only signals, reply capture with the
billing trigger (deals.first_reply_at), and the Marathon skill files.
Gmail send is NOT in this branch. Approve still hands back the mailto link.

## Order matters
1. Run migration 005 FIRST (it is additive, the current app ignores it).
2. Add the Vercel env vars.
3. Merge the PR so Vercel deploys.
4. Probe the provider with one contact and check the field mapping.
5. Backfill verification, then rescore (no --requalify).

## Commands (run from the web/ folder, with DATABASE_URL in web/.env)
    npm install
    node scripts/migrate-005-enrichment.js
    node scripts/probe-vibe.js "Full Name" "Company Name"
    node scripts/enrich-backfill.js --dry-run
    node scripts/enrich-backfill.js --limit=25
    node scripts/rescore-deals.js
Only after you review the score distribution:
    node scripts/rescore-deals.js --requalify

## Vercel env vars
EXPLORIUM_API_KEY, ENRICHMENT_PROVIDER=vibe
(CRON_SECRET, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, DATABASE_URL and
DASHBOARD_PASSWORD already exist.)

## Behavior to know
- Approve returns 409 until the contact email is verified or confirmed by hand.
- Only professional_email_status = valid counts as verified.
- Events with no source URL the search actually read are discarded.
- The 151 older signals with no source stay in the table. They no longer
  count toward scoring, because scoring requires a source URL.
- Rescore without --requalify never moves a deal between stages.
