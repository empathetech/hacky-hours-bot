# BACKLOG.md

**Level 4 — Build** | hacky-hours-bot

---

## Next Milestone — v0.3.0: Supabase rewrite

- [ ] SQL migration — `open_ideas` and `closed_ideas` tables with RLS (default deny for anon)
- [ ] Edge Function scaffold — HTTP handler, request parser, command router
- [ ] HMAC-SHA256 request verification using Slack signing secret
- [ ] `/hacky-hours help` — Block Kit command list
- [ ] `/hacky-hours submit` — modal flow with duplicate name validation
- [ ] `/hacky-hours list [page]` — paginated list via SQL LIMIT/OFFSET
- [ ] `/hacky-hours get [name]` — detail view via case-insensitive lookup
- [ ] `/hacky-hours random` — random idea via ORDER BY random()
- [ ] `/hacky-hours pick [name]` — move to closed_ideas with picked_by/picked_at
- [ ] `/hacky-hours save` — thread-to-markdown, pre-fill submit modal
- [ ] README.md runbook — Supabase setup, migrations, Edge Function deploy, Slack app config
- [ ] Archive Apps Script code to hacky-hours/archive/apps-script/

## Future

- [ ] LLM-based thread synthesis for `save` — needs design work before building
