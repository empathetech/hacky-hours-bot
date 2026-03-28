# SECURITY_PRIVACY.md

**Level 2 — Design** | hacky-hours-bot

> **Note:** Updated for Supabase architecture. See [ADR 2026-03-26](decisions/2026-03-26-switch-to-supabase.md).

---

## Data Inventory

| Data | Source | Stored where | Purpose |
|------|--------|-------------|---------|
| Slack user ID | Slack command payload (`user_id`) | Supabase Postgres | Identifies who submitted or picked an idea |
| Idea name | User input (modal) | Supabase Postgres | Lookup key for `get` and `pick` |
| Idea description | User input (modal) | Supabase Postgres | What the idea is about |
| Idea features | User input (modal) | Supabase Postgres | Desired scope / features |
| Submitted timestamp | Auto-generated | Supabase Postgres | When the idea was created |
| Picked-by user ID | Slack command payload (`user_id`) | Supabase Postgres | Who claimed the idea |
| Picked timestamp | Auto-generated | Supabase Postgres | When the idea was claimed |

| Vote name | User input (modal) | Supabase Postgres | Lookup key for `close-vote` |
| Vote caller ID | Slack command payload (`user_id`) | Supabase Postgres | Who called the vote — excluded from voting unless tiebreaker |
| Vote channel + message | Slack API response | Supabase Postgres | Tracks which message to read reactions from |
| Vote expiry | User input (modal, optional) | Supabase Postgres | Auto-close time |

**What we don't store:** emails, passwords, display names, profile photos, auth tokens, or any PII beyond Slack user IDs. Reaction data (who voted for what) is read from Slack at tally time and not persisted.

---

## Authentication & Authorization

**Authentication:** All requests are verified via **Slack Signing Secret (HMAC-SHA256)** — Slack's recommended best practice. The Edge Function has full access to HTTP headers (`X-Slack-Signature`, `X-Slack-Request-Timestamp`), enabling proper signature verification with replay protection (reject requests older than 5 minutes).

This is a security improvement over the previous Apps Script architecture, which could not access HTTP headers and relied on the deprecated verification token.

**Authorization:** Minimal role-based restrictions. Any workspace member can use all commands. The one exception: only the vote caller can close their vote (or anyone if the vote has expired). The `picked_by` field tracks who claimed an idea, but there's no restriction on who can do it.

**The `save` command** requires `channels:history` and `groups:history` scopes, granting the bot read access to channel messages. The README should explain this scope expansion clearly.

**The `vote` system** requires `reactions:read` scope and Events API subscription for `reaction_added`/`reaction_removed`. The bot reads reactions only on its own vote messages — not arbitrary channel messages. Vote callers are excluded from voting to prevent self-selection bias (unless resolving a tiebreaker).

---

## Database Access Model

### Defense in Depth

Access to the database is secured at three levels:

**Level 1 — Network:** The Supabase project URL is not public-facing. It appears only in Edge Function environment variables (set via the Supabase dashboard). It is never exposed in Slack responses, client-side code, or the git repo.

**Level 2 — API Keys:** Supabase provides two keys per project:

| Key | Access level | Where it's used |
|-----|-------------|----------------|
| `anon` key | Subject to Row Level Security (RLS) policies | **Not used.** We have no client-side access. |
| `service_role` key | Bypasses RLS — full database access | Edge Functions only. Never leaves Supabase's infrastructure. |

**Level 3 — Row Level Security (RLS):** Enabled on both tables with **no policies** — meaning the `anon` key has zero access (default deny). Even if someone obtains the project URL and `anon` key, they cannot read or write any data.

The `service_role` key bypasses RLS by design. This is Supabase's intended pattern for server-side access from trusted code (Edge Functions).

### Verification Step

After deploying, verify RLS is working by running this in the Supabase SQL Editor:

```sql
-- This should return zero rows (RLS blocks anon access)
SET role anon;
SELECT * FROM open_ideas;

-- Reset role
RESET role;
```

If it returns data, RLS is not configured correctly — rerun the migration.

---

## Threat Surface

| Threat | Mitigation |
|--------|-----------|
| Unauthenticated requests to the Edge Function URL | HMAC-SHA256 signing secret verification rejects unsigned requests |
| Slack user ID spoofing | Not possible — `user_id` comes from Slack's verified payload, not user input |
| Replay attacks | Timestamp check — reject requests older than 5 minutes |
| Database exposure via `anon` key | RLS enabled with no policies = zero access for `anon` |
| `service_role` key leaked | Key exists only in Supabase's Edge Function environment — never in code, never in git, never in HTTP responses |
| Supabase project URL leaked | Without the `service_role` key, only the `anon` key can be used, which has zero access due to RLS |
| Edge Function URL leaked | Without the Slack signing secret, requests are rejected |
| Vote manipulation via extra reactions | One-user-one-vote enforced at tally time by deduplicating Slack user IDs; caller excluded from count |
| Unauthorized vote close | Only the caller can close a vote; expired votes can be closed by anyone |

---

## Input Validation

All user input comes through Slack modals, which provide basic constraints (required fields, character limits). The Edge Function should additionally:

- **Sanitize idea names** before using them as lookup keys (trim whitespace, reject empty strings after trim)
- **Enforce the duplicate name check** on submit — the `UNIQUE` constraint on `open_ideas.name` handles this at the database level; the Edge Function translates the constraint violation into a modal validation error
- **Parameterize all SQL queries** — use the Supabase client library (which parameterizes automatically) instead of string concatenation. Never construct SQL strings from user input.
- **Do not echo raw user input in error messages** — return generic errors to Slack, log details to Edge Function logs (visible only in the Supabase dashboard)

---

## Secrets Management

All secrets live in **Supabase Edge Function environment variables** (set via dashboard or CLI). They never appear in source code.

| Secret | Purpose | Set via |
|--------|---------|---------|
| `SLACK_SIGNING_SECRET` | HMAC-SHA256 request verification | `supabase secrets set SLACK_SIGNING_SECRET=...` |
| `SLACK_BOT_TOKEN` | Calling Slack API (modals, messages) | `supabase secrets set SLACK_BOT_TOKEN=...` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions — no manual configuration needed.

**Never commit secrets to the repo.** The `.gitignore` should cover `.env` and `.env.*` files used for local development.

---

## Improvement over Previous Architecture

| Concern | Apps Script (v0.1–v0.2) | Supabase (v0.3+) |
|---------|------------------------|-------------------|
| Request verification | Deprecated verification token (no replay protection) | HMAC-SHA256 signing secret (gold standard) |
| Google account exposure | `spreadsheets` scope = access to all deployer's sheets | No Google account involved |
| Database access control | Google Sheet sharing settings (binary: shared or not) | RLS policies + separate API keys |
| Secrets storage | Script Properties (Google-managed) | Edge Function env vars (Supabase-managed) |
| Data isolation | Deployer's Google Drive | Isolated Supabase project |
