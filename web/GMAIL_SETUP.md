# Gmail connect (Marathon instance)

What this adds: Approve sends the drafted email from the connected Gmail
account through the Gmail API, follow-ups go out in the same thread, and a
reply reader checks those threads every 15 minutes on weekdays and feeds new
replies through classifyReply and recordReply (so first_reply_at, the billing
trigger, still fires exactly once).

Scopes requested: gmail.send and gmail.readonly only. Tokens are stored in
gmail_accounts encrypted with AES-256-GCM (TOKEN_ENC_KEY). Nothing logs a
token. Without the Google env vars the app behaves exactly as before: Approve
approves, Send hands back the mailto link.

Scoring, verification and the approve gate are unchanged. Send checks the
same email gate as Approve.

## A. Google Cloud setup
1. Go to https://console.cloud.google.com and sign in with your Google account.
2. Click the project picker at the top, then New project. Name it Marathon CRM. Create.
3. Make sure that project is selected in the picker.
4. Left menu, APIs and Services, Library. Search Gmail API. Open it. Click Enable.
5. Left menu, APIs and Services, OAuth consent screen (Google may call it Google Auth Platform, Branding).
6. App name: Marathon CRM. User support email: yours. Developer contact email: yours. Save.
7. Audience: choose External. Save. Leave Publishing status as Testing.
8. Open Audience (or Test users). Click Add users. Add Mike's Gmail address and your own Gmail address. Save.
9. Data access (or Scopes). Click Add or remove scopes. Filter for Gmail API. Tick
   https://www.googleapis.com/auth/gmail.send and
   https://www.googleapis.com/auth/gmail.readonly. Update. Save.
10. Left menu, Clients (or Credentials). Create credentials, OAuth client ID.
11. Application type: Web application. Name: Marathon dashboard.
12. Authorized redirect URIs, Add URI, paste exactly:
    https://marathon-crm-dashboard.vercel.app/api/google/callback
13. Create. Copy the Client ID and the Client secret somewhere safe for the next section. Do not paste them in chat.

Note: in Testing mode Google expires refresh tokens after 7 days. Mike would
have to click Connect Gmail again weekly. When this is working, come back to
the consent screen and click Publish app. Google may show a warning about
verification; for these two scopes with a single internal user that is fine
to proceed, and the tokens then stop expiring.

## B. Vercel env vars
Project Settings, Environment Variables, Production (and Preview if you test on previews). Add:
1. GOOGLE_CLIENT_ID = the Client ID from step A13
2. GOOGLE_CLIENT_SECRET = the Client secret from step A13
3. GOOGLE_REDIRECT_URI = https://marathon-crm-dashboard.vercel.app/api/google/callback
4. TOKEN_ENC_KEY = output of `openssl rand -hex 32` on your Mac (64 hex characters)
5. CRON_SECRET already exists. Leave it.
6. Redeploy (Deployments, latest, Redeploy) so the new vars load.

Cron note: /api/cron/replies runs every 15 minutes on weekdays. Vercel Hobby
plan only allows crons that run once a day. If the deploy complains about the
cron schedule, either upgrade the project to Pro or change the schedule in
web/vercel.json to once a day (for example "0 13 * * 1-5").

## C. Testing, your Gmail first
1. Merge the PR so the new code deploys.
2. Open the dashboard, log in, go to /runs.
3. Click 1. Run migration (it now runs 005 and 006, both safe to repeat).
4. In the Gmail card click Connect Gmail.
5. Pick your Google account. Google shows "app is not verified" because it is in Testing: click Continue.
6. Tick both boxes (send email, read email). Click Continue / Allow.
7. You land back on /runs and the card says Connected as your address.
8. Create a test deal whose contact is one of your own email addresses (a different one than the connected account works best). Verify the email by hand on the deal page.
9. Let the pipeline draft it, or regenerate a draft on the deal page.
10. On the dashboard click Approve & Send. It should say Sent from your address.
11. Check the Sent folder of the connected Gmail. The email is there, and the deal moved to Contacted with an "Email sent via Gmail" activity.
12. From the other inbox, reply to that email with something like "Sure, send me more info."
13. Wait for the next 15 minute cron, or hit it yourself:
    curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://marathon-crm-dashboard.vercel.app/api/cron/replies
14. Open the deal. It should be in Replied with a reply activity, classified positive, and the first positive reply date set.
15. On /runs click Disconnect.

## D. Then Mike
1. Confirm Mike's Gmail is listed as a test user (step A8).
2. Have Mike log in to the dashboard on his own computer.
3. He goes to /runs and clicks Connect Gmail.
4. He picks his Marathon Group account, clicks Continue on the unverified warning, ticks both boxes, clicks Continue.
5. The card shows Connected as his address.
6. From now on his Approve & Send button sends from his address and replies land on the deal automatically.
7. Once that works, publish the app (see the note under A) so he does not have to reconnect every week.

## Commands
    npm run migrate:gmail      # node scripts/migrate-006-gmail.js, needs DATABASE_URL in web/.env
    npm run test:gmail         # unit tests with a mock Gmail client, no network
