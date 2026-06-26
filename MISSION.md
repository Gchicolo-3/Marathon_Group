# Marathon Pipeline Engine - Orchestrator Rules

## Orchestrator Can Decide Autonomously
- Run any agent on schedule
- Skip prospects with qualification score below 6
- Retry failed agent steps up to 3 times
- Move prospect status from new to qualified or disqualified
- Advance prospect to next campaign week
- Log all activity to database
- Send Michael the daily digest

## Requires Michael Approval
- Sending any email directly (all go to Gmail drafts first)
- Marking a prospect permanently dead
- Changing campaign sequence for existing prospect
- Adding new target vertical or geography

## Agent Rules
- Each agent runs one task only
- Agents never communicate directly with each other
- All communication goes through orchestrator
- Failed agents report error and stop, orchestrator handles retry

## Qualification Scoring
- Score below 6: skip, log reason, no email drafted
- Score 6-7: draft email, flag for Michael review
- Score 8-10: draft email, high priority flag

## Daily Schedule
- Pipeline runs at 7:00 AM Eastern every weekday
- Daily digest sent to Michael at 8:00 AM Eastern
- Digest includes: prospects found, emails drafted, pending approvals, flags

## Failure Handling
- 3 consecutive agent failures: pause pipeline, notify Michael
- Gmail API failure: save drafts to database, retry next run
- Perplexity API failure: skip prospecting, log error
- Claude API failure: skip draft generation, log error
