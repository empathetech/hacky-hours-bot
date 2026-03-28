# Iteration — Post v0.3.1

## Raw Capture

### Bug — `/hacky-hours save` was broken (SHIPPED as v0.3.1)
- Slack slash commands don't include `thread_ts` in their payload
- Command always errored, even from inside a thread
- Fix: accept a pasted thread link as argument, parse channel + timestamp from URL
- Also improved error messages to surface actual Slack API errors

### CI — GitHub Actions deploy workflow fails on `db push`
- `supabase db push` requires `SUPABASE_DB_PASSWORD` which isn't in GitHub Actions secrets
- Function deploy step never runs because migration step fails first
- Fix: add the secret and pass it as env var in workflow

### Feature — Vote on ideas
- Let community members vote on ideas to surface interest
- Needs: data model (votes table), vote limits (one per user per idea), display in `list`/`get`
- Consider: unvote, vote count sorting, preventing self-votes

## Triage

| Item | Priority | Design impact |
|------|----------|---------------|
| Save command fix | SHIPPED (v0.3.1) | ARCHITECTURE.md updated |
| CI secret fix | Next milestone | No design impact — config only |
| Vote feature | Next milestone | DATA_MODEL.md, ARCHITECTURE.md, SECURITY_PRIVACY.md |
