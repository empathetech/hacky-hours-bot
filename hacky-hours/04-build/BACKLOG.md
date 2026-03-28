# BACKLOG.md

**Level 4 — Build** | hacky-hours-bot

---

## Next Milestone

- [ ] Add `SUPABASE_DB_PASSWORD` to GitHub Actions secrets and pass it to `supabase db push` in deploy workflow — currently the migration step fails with auth error

## Future

- [ ] `/hacky-hours vote [name]` — let users vote on ideas to surface community interest — needs design work (data model, vote limits, display in `list`/`get`)
- [ ] LLM-based thread synthesis for `save` — needs design work before building
