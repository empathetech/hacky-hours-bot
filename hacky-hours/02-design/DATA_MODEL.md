# DATA_MODEL.md

**Level 2 — Design** | hacky-hours-bot

> **Note:** Updated for Supabase Postgres. See [ADR 2026-03-26](decisions/2026-03-26-switch-to-supabase.md).

---

## Overview

All data lives in a single Supabase Postgres database with two tables. Ideas start in `open_ideas` and move to `closed_ideas` when claimed. No data is deleted — closing an idea is a move, not a delete.

Row Level Security (RLS) is enabled on both tables. All access goes through the `service_role` key via the Edge Function — no direct client access.

```mermaid
erDiagram
    open_ideas {
        uuid id PK
        text name UK
        text submitter_id
        text description
        text features
        timestamptz submitted_at
    }
    closed_ideas {
        uuid id PK
        text name
        text submitter_id
        text description
        text features
        timestamptz submitted_at
        text picked_by
        timestamptz picked_at
    }
    open_ideas ||--o| closed_ideas : "pick moves row"
```

---

## Schema

### open_ideas

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Auto-generated unique ID |
| `name` | `text` | NOT NULL, UNIQUE | Idea title. Lookup key for `get` and `pick` commands. |
| `submitter_id` | `text` | NOT NULL | Slack user ID (e.g., `U024BE7LH`). Stable — doesn't change if the user renames their profile. |
| `description` | `text` | NOT NULL | What the idea is about. Free text. |
| `features` | `text` | | Desired features or scope. Free text. Optional. |
| `submitted_at` | `timestamptz` | NOT NULL, default `now()` | Timestamp when the idea was submitted. |

### closed_ideas

Same columns as `open_ideas`, plus:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `picked_by` | `text` | NOT NULL | Slack user ID of the person who claimed the idea. |
| `picked_at` | `timestamptz` | NOT NULL, default `now()` | Timestamp when the idea was picked. |

Note: `name` is NOT unique in `closed_ideas` — the same name could be resubmitted and picked multiple times over the life of the project.

---

## SQL Migration

This migration file will live in `supabase/migrations/` and be applied via `supabase db push`:

```sql
-- Create open_ideas table
CREATE TABLE open_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    submitter_id text NOT NULL,
    description text NOT NULL,
    features text DEFAULT '',
    submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Create closed_ideas table
CREATE TABLE closed_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    submitter_id text NOT NULL,
    description text NOT NULL,
    features text DEFAULT '',
    submitted_at timestamptz NOT NULL,
    picked_by text NOT NULL,
    picked_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security on both tables
ALTER TABLE open_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_ideas ENABLE ROW LEVEL SECURITY;

-- Deny all access via the anon key (default deny)
-- The service_role key (used by Edge Functions) bypasses RLS by design.
-- No policies = no access for anon. This is intentional.
```

---

## Operations

| Command | Operation | SQL |
|---------|-----------|-----|
| `help` | None | None |
| `submit` | Insert | `INSERT INTO open_ideas (name, submitter_id, description, features) VALUES (...)` |
| `list [page]` | Read | `SELECT * FROM open_ideas ORDER BY submitted_at LIMIT 10 OFFSET (page-1)*10` |
| `get [name]` | Read | `SELECT * FROM open_ideas WHERE lower(name) = lower(...)` |
| `random` | Read | `SELECT * FROM open_ideas ORDER BY random() LIMIT 1` |
| `pick [name]` | Read + Insert + Delete | Find row, `INSERT INTO closed_ideas (...)`, `DELETE FROM open_ideas WHERE id = ...` |
| `save [link]` | Read (Slack API) + modal | No database operation until user submits the modal |
| `vote` | Insert + Slack API | `INSERT INTO votes`, `INSERT INTO vote_ideas`, post vote message |
| `close-vote [name]` | Read + tally + pick | Read reactions, tally, resolve ties, run pick flow for winners |

---

## Vote Tables (v0.4.0)

```mermaid
erDiagram
    votes {
        uuid id PK
        text name UK
        text caller_id
        text channel_id
        text message_ts
        text emoji
        integer max_winners
        timestamptz expires_at
        timestamptz created_at
    }
    vote_ideas {
        uuid id PK
        uuid vote_id FK
        uuid idea_id FK
    }
    open_ideas ||--o{ vote_ideas : "included in vote"
    votes ||--o{ vote_ideas : "contains"
```

### votes

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Auto-generated unique ID |
| `name` | `text` | NOT NULL, UNIQUE | User-chosen vote name. Lookup key for `close-vote`. |
| `caller_id` | `text` | NOT NULL | Slack user ID of the person who called the vote. Cannot vote unless tiebreaker. |
| `channel_id` | `text` | NOT NULL | Channel where the vote message was posted. |
| `message_ts` | `text` | NOT NULL | Timestamp of the bot's vote message — used to read reactions. |
| `emoji` | `text` | NOT NULL, default `'white_check_mark'` | Emoji used for voting on this poll. |
| `max_winners` | `integer` | NOT NULL, default `1` | Number of ideas to select (for multi-winner votes). |
| `expires_at` | `timestamptz` | | Optional auto-close time. NULL = manual close only. |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the vote was created. |

### vote_ideas

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | Auto-generated unique ID |
| `vote_id` | `uuid` | NOT NULL, REFERENCES `votes(id) ON DELETE CASCADE` | Which vote this belongs to |
| `idea_id` | `uuid` | NOT NULL, REFERENCES `open_ideas(id)` | Which idea is being voted on |

Unique constraint on `(vote_id, idea_id)` — an idea can only appear once per vote.

### Operations

| Command | Operation | SQL |
|---------|-----------|-----|
| `vote` | Insert vote + vote_ideas, post message | `INSERT INTO votes ...`, `INSERT INTO vote_ideas ...` |
| `close-vote [name]` | Read reactions, tally, resolve ties, pick winners | `SELECT` from votes + vote_ideas, then `pick` flow for winners |

### Limits

- **Max concurrent votes:** 5 (configurable via `MAX_OPEN_VOTES` env var, default `5`)
- **Enforced at insert time:** reject if `SELECT count(*) FROM votes` >= limit
- **Stale vote cleanup:** votes with `expires_at` in the past are auto-closed on next interaction (lazy cleanup)

---

## Constraints

- **`name` is the lookup key** — must be unique across `open_ideas`. The `UNIQUE` constraint enforces this at the database level. On `submit`, if the name already exists, Postgres returns an error which the Edge Function translates into a modal validation error ("An idea with this name already exists — try a different name"). The modal stays open with all other fields intact.
- **Pagination** — `list` returns 10 ideas per page. Page number is an optional parameter (default: 1). Footer includes "Page X of Y" and a hint for the next page command.
- **No editing** — once submitted, an idea can't be modified. Acceptable for MVP.
- **Move, not copy** — `pick` deletes the row from `open_ideas` and inserts it into `closed_ideas`. The original row is not preserved in `open_ideas`.
- **Case-insensitive lookup** — `get` and `pick` use `lower()` for name matching.
