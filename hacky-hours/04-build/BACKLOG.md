# BACKLOG.md

**Level 4 — Build** | hacky-hours-bot

---

## Next Milestone — v0.4.0

- [ ] SQL migration: `votes` and `vote_ideas` tables with RLS (default deny for anon)
- [ ] Events API: `url_verification` challenge handler in Edge Function
- [ ] Events API: `reaction_added`/`reaction_removed` event handler — validate voter, enforce caller exclusion
- [ ] `/hacky-hours vote` command — modal with idea multi-select, vote name, optional duration
- [ ] Vote message posting — formatted Block Kit message with emoji prompt and idea list
- [ ] Max concurrent votes enforcement (configurable via `MAX_OPEN_VOTES`, default 5)
- [ ] `/hacky-hours close-vote [name]` — tally reactions, determine winner(s)
- [ ] Tie resolution — bot-decides (random) or caller-decides (interactive) options
- [ ] Duration parsing + auto-close for expired votes (lazy cleanup)
- [ ] CI fix: add `SUPABASE_DB_PASSWORD` to GitHub Actions deploy workflow
- [ ] README update: new scopes, Event Subscriptions setup, vote/close-vote command docs

## Future

- [ ] v0.5.0: Post-vote repo scaffolding (GitHub API, org repo creation, IDEATION.md seed, issue seeding)
- [ ] LLM-based thread synthesis for `save` — needs design work before building
