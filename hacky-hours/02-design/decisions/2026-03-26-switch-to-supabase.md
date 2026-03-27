# ADR: Switch from Apps Script + Google Sheets to Supabase Edge Functions + Postgres

**Date:** 2026-03-26
**Status:** Accepted
**Supersedes:** Original architecture (Apps Script + Google Sheets)

## Context

The original architecture used Google Apps Script as the runtime and Google Sheets as the data store. This required deployers to grant the `spreadsheets` OAuth scope, which gives the script read/write access to *all* spreadsheets on the deployer's Google account — not just the one used by the bot.

For deployers who use their personal Google account, this is an unacceptable security exposure. The alternatives considered were:

1. **Separate Google account** — eliminates personal exposure but doesn't fix the underlying scope problem for forkers
2. **Service account** — isolates Sheet access but still requires Google Cloud setup and the broad scope applies to the service account
3. **Alternative storage backend** — eliminates the Google Sheets dependency entirely

## Decision

Replace the entire Apps Script + Google Sheets stack with **Supabase Edge Functions + Supabase Postgres**.

**Before:**
```
Slack → Google Apps Script → Google Sheets
```

**After:**
```
Slack → Supabase Edge Function → Supabase Postgres
```

## Rationale

### Security
- No Google OAuth scope exposure — Supabase is accessed via project-scoped API keys
- Row Level Security (RLS) enforced at the database level — even if the `anon` key leaks, no data is accessible
- The `service_role` key (used by Edge Functions) never leaves Supabase's infrastructure
- No personal Google account involved at all

### Developer experience
- Single platform instead of two (no clasp, no Apps Script editor, no Google Cloud Console)
- TypeScript/Deno instead of Apps Script's limited JavaScript
- Local development via `supabase functions serve`
- Standard git workflow — Edge Functions deploy from the repo
- Can write and run actual tests

### Non-technical accessibility
- Supabase dashboard has a spreadsheet-like table view for browsing data
- Team members can be invited to the Supabase project with read-only access
- No Google account required for any participant

### Template/fork model
- Forkers create a Supabase project, set environment variables, deploy — same pattern but without the Google scope concern
- SQL migration files in the repo make schema setup reproducible and version-controlled

## Tradeoffs

- **Full rewrite** — all business logic must be rewritten from Apps Script (.gs) to TypeScript
- **New dependency** — Supabase replaces Google (different vendor, same category of risk)
- **Free tier constraints** — Supabase free tier pauses after 1 week of inactivity; Edge Functions have 500K invocations/month limit
- **Learning curve** — deployers need to learn Supabase instead of Google Apps Script (arguably simpler)
- **Existing v0.1.0–v0.2.1 code** — the Apps Script implementation is abandoned; moved to `archive/`

## Consequences

### Design docs to update
- **ARCHITECTURE.md** — complete rewrite (new system diagram, components, configuration, deployment)
- **DATA_MODEL.md** — update from Sheets tabs/rows to Postgres tables with SQL schema
- **SECURITY_PRIVACY.md** — new threat model (Supabase keys, RLS policies, no Google scopes)
- **LICENSING.md** — Supabase is open source (Apache 2.0); compatible with MIT
- **PRODUCT_OVERVIEW.md** — update Infrastructure Preference section

### Files to update
- `src/` — replace .gs files with TypeScript Edge Functions
- `README.md` — new setup guide (Supabase project, Edge Functions, Slack app)
- `.gitignore` — remove clasp, add Supabase-specific entries
- `CLAUDE.md` — no changes needed (paths are the same)

### What stays the same
- All Slack-facing behavior (commands, Block Kit responses, modals)
- The data model (same fields, same two-table structure)
- The template/fork deployment model
- The Hacky Hours framework documentation structure
