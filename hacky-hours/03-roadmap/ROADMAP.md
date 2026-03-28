# ROADMAP.md

**Level 3 — Roadmap** | hacky-hours-bot

> **Note:** Updated for Supabase architecture. See [ADR 2026-03-26](../02-design/decisions/2026-03-26-switch-to-supabase.md). MVP items 1–10 and V2 items 11–12 were completed under the previous Apps Script architecture (v0.1.0–v0.2.1). This roadmap reflects the rewrite.

---

## v0.3.0 — Supabase rewrite: same features, new architecture

1. **Supabase project setup** — SQL migration for `open_ideas` and `closed_ideas` tables with RLS enabled (default deny for `anon` key)
2. **Edge Function scaffold** — HTTP handler, request parser, command router (TypeScript/Deno)
3. **HMAC-SHA256 request verification** — proper signing secret verification using HTTP headers (replaces deprecated verification token)
4. **`/hacky-hours help`** — Block Kit command list
5. **`/hacky-hours submit`** — modal flow with duplicate name validation via Postgres UNIQUE constraint
6. **`/hacky-hours list [page]`** — paginated Block Kit list (10/page) via SQL LIMIT/OFFSET
7. **`/hacky-hours get [name]`** — Block Kit detail view via case-insensitive SQL lookup
8. **`/hacky-hours random`** — random idea via `ORDER BY random() LIMIT 1`
9. **`/hacky-hours pick [name]`** — move to `closed_ideas` with `picked_by`/`picked_at`
10. **`/hacky-hours save`** — thread-to-markdown, pre-fill submit modal
11. **README.md runbook** — Supabase project setup, migrations, Edge Function deployment, Slack app configuration
12. **Archive Apps Script code** — move `src/` to `hacky-hours/archive/apps-script/`

## v0.4.0 — Vote system: community-driven idea selection

1. **Vote data model** — `votes` and `vote_ideas` tables with RLS, migration file
2. **Slack Events API integration** — `url_verification` handler, `reaction_added`/`reaction_removed` event handling
3. **`/hacky-hours vote`** — modal with idea multi-select, vote name, optional duration; posts vote message to channel
4. **Reaction tracking** — validate voters (exclude caller, deduplicate), enforce max concurrent votes
5. **`/hacky-hours close-vote [name]`** — tally reactions, handle ties (bot-decides or caller-decides), run pick flow for winners
6. **Auto-close on expiry** — lazy cleanup on next interaction; duration parsing ("5m", "1h")
7. **CI fix** — add `SUPABASE_DB_PASSWORD` to GitHub Actions deploy workflow
8. **README update** — new scopes (`reactions:read`), Event Subscriptions setup, vote command docs

## v0.5.0 — Post-vote repo scaffolding

1. GitHub API integration (App or PAT) for org-level repo creation
2. Create repo from winning idea (lowercase-kebab-case)
3. Scaffold `hacky-hours/01-ideate/IDEATION.md` from idea description + features
4. Seed GitHub Issues from idea content
5. Post "repo is ready" message back to Slack

## Future

- [ ] LLM-based thread synthesis for `save` — needs design work before building
