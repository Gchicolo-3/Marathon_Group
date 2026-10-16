# Gmail go live (Marathon instance)

What this adds: a Connect Gmail button on /runs. Once connected, Approve then Send
sends from the connected mailbox and replies are read back automatically (first
positive reply starts the billing clock). Without it, Send still falls back to
opening the mail app.

## A. Google Cloud (one time, on a laptop, about 15 minutes)
1. Go to console.cloud.google.com and sign in with the account that will own the app.
2. Top left, project picker, New Project. Name it Marathon CRM. Create.
3. Menu, APIs and Services, Library. Search Gmail API. Click it, click Enable.
4. APIs and Services, OAuth consent screen. User type External. App name Marathon CRM,
   support email yours, developer email yours. Save and continue.
5. Scopes step: Add or remove scopes, add gmail.send and gmail.readonly. Save.
6. Test users step: Add users. Add Mike's Gmail address and your own. Save.
   Leave publishing status on Testing.
7. APIs and Services, Credentials, Create credentials, OAuth client ID.
   Application type Web application. Name Marathon CRM.
   Authorized redirect URI: https://marathon-crm-dashboard.vercel.app/api/google/callback
   Create. Copy the Client ID and Client secret.

## B. Vercel environment variables
Project marathon-crm-dashboard, Settings, Environment Variables. Add for Production:
- GOOGLE_CLIENT_ID (from step 7)
- GOOGLE_CLIENT_SECRET (from step 7)
- GOOGLE_REDIRECT_URI = https://marathon-crm-dashboard.vercel.app/api/google/callback
- TOKEN_ENC_KEY = any random 40+ character string
Redeploy so they take effect (Deployments, latest, Redeploy).

## C. Turn it on
1. Open /runs, tap 1. Run migration (runs 005 and 006, safe to repeat).
2. Test with your own Gmail first: tap Connect Gmail, pick your account.
   Google shows "Google hasn't verified this app" in Testing mode. Tap Advanced, then
   Go to Marathon CRM (unsafe), then Continue. This is normal.
3. Send yourself a test: use a deal whose contact email is your own address, mark it
   verified by hand, approve, send. Reply from that inbox. Tap Check replies now.
4. For Mike: he opens /runs, taps Connect Gmail, chooses his Marathon address, Continue.
   Tap Reconnect any time to switch mailbox.

## Notes
- Replies are checked once a day by the pipeline run, and on demand with Check replies now.
  The Vercel plan only allows daily crons. /api/cron/replies exists for a pinger or a
  paid plan (every 15 minutes).
- Tokens are encrypted in the gmail_accounts table. Changing TOKEN_ENC_KEY disconnects Gmail.
- Testing mode caps at 100 test users and refresh tokens expire after 7 days. Before relying
  on this for real, publish the consent screen (Google verification for sensitive scopes).
