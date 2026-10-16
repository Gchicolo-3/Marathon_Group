// Reply capture. recordReply() is the ONE place a reply enters the system:
// the manual "log a reply" box uses it today and the Gmail reader will call
// the same function. The billing trigger, deals.first_reply_at, is set here
// and nowhere else.
//
// A positive reply is one where the contact asks a question, wants info,
// agrees to talk, or refers us. Out of office, bounces and declines do not
// count. See web/lib/skills/RULES.md.
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');
const q = require('./queries');

const CLASSES = ['positive', 'negative', 'neutral', 'out_of_office', 'bounce'];

const BOUNCE_RE = /(mailer-daemon|delivery status notification|undeliverable|address not found|550 5\.\d\.\d|message not delivered|delivery has failed)/i;
const OOO_RE = /(out of (the )?office|automatic reply|auto-?reply|on (annual )?leave|currently away|will be (out|away) (of the office )?until)/i;

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic();
  }
  return client;
}

// Cheap deterministic checks first, the model only for real human replies.
async function classifyReply(text) {
  const t = (text || '').trim();
  if (!t) return { classification: 'neutral', reason: 'empty reply' };
  if (BOUNCE_RE.test(t)) return { classification: 'bounce', reason: 'delivery failure notice' };
  if (OOO_RE.test(t.slice(0, 600))) return { classification: 'out_of_office', reason: 'auto reply' };

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Classify this email reply to a cold outreach from Marathon Group (owner's representative and construction project management).

POSITIVE means the person asks a question, asks for information, agrees to talk or meet, or refers us to someone else.
NEGATIVE means they decline, ask to be removed, or say they are not interested.
NEUTRAL means a human reply that is none of the above (acknowledgement only, unclear).

Reply:
"""
${t.slice(0, 3000)}
"""

Return ONLY JSON: {"classification": "positive" | "negative" | "neutral", "reason": "one short sentence"}`,
    }],
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  const classification = CLASSES.includes(parsed.classification) ? parsed.classification : 'neutral';
  return { classification, reason: parsed.reason || '' };
}

// Records a reply on a deal. Returns { classification, first_positive, deal }.
//  - positive/negative/neutral: deal moves to Replied (the sequence stops)
//  - out_of_office: logged only, sequence continues
//  - bounce: logged, contact email marked invalid so it cannot be re-approved
//  - first_reply_at is set once, on the first positive reply
async function recordReply(dealId, { text, classification, reason } = {}) {
  const deal = await q.getDeal(dealId);
  if (!deal) return null;

  let cls = classification;
  let why = reason || '';
  if (!cls || !CLASSES.includes(cls)) {
    const c = await classifyReply(text);
    cls = c.classification;
    why = c.reason;
  }

  const snippet = (text || '').trim().replace(/\s+/g, ' ').slice(0, 280);
  await q.logActivity(dealId, 'reply', `Reply (${cls.replace(/_/g, ' ')})${why ? `: ${why}` : ''}${snippet ? ` | "${snippet}"` : ''}`);

  let firstPositive = false;
  if (cls === 'positive') {
    const r = await db.query(
      `UPDATE deals SET first_reply_at = now(), reply_classification = 'positive', updated_at = now()
       WHERE id = $1 AND first_reply_at IS NULL RETURNING id`,
      [dealId]
    );
    firstPositive = r.rows.length > 0;
    if (!firstPositive) {
      await db.query(`UPDATE deals SET reply_classification = 'positive' WHERE id = $1`, [dealId]);
    }
  } else if (cls === 'negative' || cls === 'neutral') {
    await db.query(`UPDATE deals SET reply_classification = $2 WHERE id = $1 AND first_reply_at IS NULL`, [dealId, cls]);
  }

  if (['positive', 'negative', 'neutral'].includes(cls) && !['replied', 'meeting_set', 'won'].includes(deal.stage)) {
    await q.setDealStage(dealId, 'replied');
  }
  if (cls === 'bounce') {
    await db.query(`UPDATE contacts SET email_status = 'invalid' WHERE id = $1`, [deal.contact_id]);
  }

  return { classification: cls, reason: why, first_positive: firstPositive, deal: await q.getDeal(dealId) };
}

module.exports = { classifyReply, recordReply, CLASSES };
