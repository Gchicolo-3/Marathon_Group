// Daily digest data + delivery. Digest covers the last 24 hours:
// drafts created, emails sent, replies, stage changes, and the current
// approval-queue depth. Email delivery uses Resend when RESEND_API_KEY and
// DIGEST_TO are configured; otherwise the digest is compute-only (the
// dashboard strip still shows it).
const db = require('./db');

async function getDigest() {
  const r = await db.query(
    `SELECT
       (SELECT count(*) FROM email_drafts WHERE ai_generated_at > now() - interval '24 hours')::int AS drafted_24h,
       (SELECT count(*) FROM activities WHERE type = 'email_sent' AND created_at > now() - interval '24 hours')::int AS sent_24h,
       (SELECT count(*) FROM activities WHERE type = 'stage_change' AND created_at > now() - interval '24 hours')::int AS stage_changes_24h,
       (SELECT count(*) FROM deals WHERE stage = 'replied')::int AS replied_now,
       (SELECT count(*) FROM deals d
        WHERE (SELECT e.status FROM email_drafts e WHERE e.deal_id = d.id ORDER BY e.id DESC LIMIT 1) = 'pending')::int AS pending_approval,
       (SELECT count(*) FROM deals WHERE stage = 'new')::int AS unscored`
  );
  return r.rows[0];
}

// Plain-English morning brief for the dashboard's "Today's Brief" panel.
// Stored in agent_runs (run_type 'morning_brief', notes column) by the
// digest cron each weekday morning.
function composeBrief(d, signalsWeek = 0) {
  const n = (count, singular, plural) => `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
  const lines = [];

  lines.push(
    d.pending_approval > 0
      ? `${n(d.pending_approval, 'email is', 'emails are')} waiting for your approval in the queue — that's the one thing that needs you today.`
      : `Nothing is waiting for your approval — the queue is clear.`
  );
  lines.push(
    `In the last 24 hours the system drafted ${n(d.drafted_24h, 'new email')} and ${n(d.sent_24h, 'email')} went out.`
  );
  if (d.unscored > 0) {
    lines.push(`${n(d.unscored, 'new prospect is', 'new prospects are')} waiting to be scored on the next run.`);
  }
  if (d.replied_now > 0) {
    lines.push(`${n(d.replied_now, 'deal is', 'deals are')} sitting in Replied — worth a look.`);
  }
  if (signalsWeek > 0) {
    lines.push(`The news agent flagged ${n(signalsWeek, 'trigger event')} this week — check the Signals tab for openers.`);
  }
  return lines.join('\n');
}

function digestHtml(d, baseUrl) {
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px;color:#64748b">${label}</td>
     <td style="padding:6px 12px;font-weight:600;text-align:right">${value}</td></tr>`;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px">
    <h2 style="margin:0 0 4px">Marathon Group CRM — daily digest</h2>
    <p style="margin:0 0 16px;color:#64748b">Last 24 hours</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e2e8f0;border-radius:8px">
      ${row('Emails drafted', d.drafted_24h)}
      ${row('Emails sent', d.sent_24h)}
      ${row('Stage changes', d.stage_changes_24h)}
      ${row('Deals in Replied', d.replied_now)}
      ${row('Awaiting your approval', d.pending_approval)}
      ${row('New deals awaiting scoring', d.unscored)}
    </table>
    <p style="margin:16px 0">
      <a href="${baseUrl}/queue" style="color:#1d4ed8">Review the approval queue →</a>
    </p>
  </div>`;
}

// Sends via Resend. Returns 'sent', or a reason string for why it didn't.
async function sendDigestEmail(digest) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.DIGEST_TO;
  if (!key || !to) return 'skipped: RESEND_API_KEY / DIGEST_TO not configured';

  const baseUrl = process.env.APP_URL || 'https://marathon-crm-dashboard.vercel.app';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM || 'Marathon CRM <onboarding@resend.dev>',
      to: [to],
      subject: `CRM digest: ${digest.pending_approval} awaiting approval, ${digest.drafted_24h} drafted`,
      html: digestHtml(digest, baseUrl),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err.slice(0, 200)}`);
  }
  return 'sent';
}

module.exports = { getDigest, composeBrief, sendDigestEmail };
