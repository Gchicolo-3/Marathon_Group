# Marathon Group Keep Warm: How It Works

Written for Mike. About five minutes to set up, then a few minutes on Sunday.

What it does: every Sunday morning it picks the people in your network who are due for a hello, writes a short two line note to each one in your voice, and lines them up for you. Nothing is ever sent until you tap Send.

## 1. Sign in

1. Open the link George sent you.
2. Tap Sign in with Google.
3. Pick the Gmail account you send email from.
4. Google asks to let the app send email for you and read replies to the notes it sends. Tick both boxes and continue.

Only addresses George has set up can get in. Anyone else gets turned away.

## 2. Upload your Excel file

1. On the setup screen, go to Bring in your people.
2. Pick your Excel or CSV file. Every tab is read.
3. Check the preview. Untick any tab you do not want.
4. Tap Import.

It finds the Name, Email, Company, Title, Phone and Notes columns on its own. If the same person is on two tabs, they only come in once. You can import again later from the People page with Import more; nobody gets doubled.

## 3. Set how often to touch each person

1. Pick a default: every month, every 2 months, every 3 months, every 6 months, or once a year.
2. To change one person, open the People page, find them, and change How often.
3. While you are there, add a line in Your note about them (for example, "worked together at Montefiore"). The writer uses it.

## 4. Paste 2 or 3 of your emails

1. Open your Sent folder and copy an email you wrote to someone you know.
2. Paste it into Teach it how you write. Add one or two more.
3. Tap Save.

The more it sees, the more the notes sound like you.

## 5. Finish setup

Tap Finish and write my first notes. You land on This Week.

## 6. This Week: your notes

Each card shows who it is to, your note about them, and the draft.

1. Read it. Edit the subject or the text right in the box if you want.
2. Tap Send. It goes from your own Gmail, and the next touch for that person is scheduled.
3. Not this week? Tap Skip. They come back next cycle.

## 7. Redo

Not quite right? Tap Redo, type what you want (for example, "mention the Lenox Hill job, ask about lunch"), then tap Rewrite. You get a fresh draft. Nothing sends until you tap Send.

## 8. Sunday email

Every Sunday morning you get a short email from your Gmail to your Gmail listing who is up that week, with a link back here. Turn it off in Settings under Sunday email to myself.

## 9. Replies

When someone writes back, the note shows Replied under Recently sent. Their reply is in your normal inbox like any other email.

## Good to know

- Going on vacation? Settings, Pause everything. No new notes until you turn it back on.
- Settings also has the most notes per week and how your notes are signed.
- Want to write notes before Sunday? On This Week, tap Write this week's notes now.
- Take someone off the list: People, find them, Remove from list.

## For whoever maintains this

- Vercel project marathon-crm-dashboard, Root Directory web/. Data in Neon Postgres.
- Sign in is Google only. ALLOWED_EMAILS is a comma separated list; the first address is the owner (Mike), whose sign in sets the sending Gmail. Others can sign in without replacing it. Removing an address locks that person out on their next click.
- Env vars: DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENC_KEY, ALLOWED_EMAILS, CRON_SECRET. Optional: GOOGLE_REDIRECT_URI (defaults to the site's own /api/google/callback), SESSION_SECRET, SHOW_PROSPECTING=1 to show the Phase B screens, PIPELINE_MODE=outbound to turn outbound drafting on (off by default).
- Every host used for sign in needs its /api/google/callback added as an Authorized redirect URI on the Google OAuth client.
- Tests: npm run test:auth, npm run test:gmail, npm run test:keepwarm.
