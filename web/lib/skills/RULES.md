# Marathon Group LLC - Operating Rules

These are hard rules. They are enforced in code, not only in prompts.

## Approval Gate
Mike reviews and approves every email before it goes out. There is no
autonomous send. Approve is the send: when Gmail is connected, his click
sends the email from his own address. Nothing leaves without that click.

## Verification Gate
A contact's email must be verified before it can be approved. Verified means
the data provider reports the address as valid, or a person confirmed it by
hand. Catch all, invalid, unknown and not found addresses block Approve.
Only professional_email_status = valid counts as verified. A lookup that
finds no match costs nothing and is retried at most 3 times, 30 days apart.

## Source Rule
A trigger event with no source URL is discarded. A signal must come from a
URL the search actually read. The system never invents a source.

## Automation Line
Runs without Mike touching it: pull signals (news, growth, expansion,
relocation), identify the decision makers, verify their contact details, score
and draft. Mike's only job is the approval queue.

## Sequence
The system runs the follow up sequence. Mike has no minimum follow up task.
Follow ups appear in the same queue for approval. A reply of any human kind
moves the deal to Replied and stops the sequence. An out of office reply is
logged and the sequence continues. A bounce marks the email invalid.

## What Counts as a Positive Reply
A positive reply is one where the contact asks a question, asks for
information, agrees to talk or meet, or refers us to someone else.
Not positive: out of office, bounces, declines, unsubscribe requests, and
acknowledgements with no ask.

## Billing Trigger
The first positive reply sets deals.first_reply_at once. That timestamp is
the machine logged billing trigger and it is shown on the dashboard.

## Success Metric (90 days)
More qualified contacts in the pipeline, and actual meetings booked, not
just contacts logged or qualified.
