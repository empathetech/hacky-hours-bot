# PRODUCT_OVERVIEW.md

**Level 1 — Ideation** | hacky-hours-bot

---

## Who — Target Audience

Community members in Slack workspaces that host Hacky Hours sessions — people who have project ideas to share and people looking for something to work on.

## What — Product Description

A Slack bot (slash command) that lets users submit, browse, and claim project ideas for Hacky Hours sessions. It stores everything in a Google Sheet — no database, no server to maintain.

The bot is a **template** — fork it, configure your environment variables for your own Slack workspace and Google Sheet, and deploy. No hardcoded relationships with any particular Slack or Google account.

**Commands:**
- `/hacky-hours help` — lists available commands with a one-line description for each
- `/hacky-hours submit` — opens a modal to create a new idea (name, description, features) → saves to "Open Ideas" tab
- `/hacky-hours list` — lists all ideas from "Open Ideas"
- `/hacky-hours get [name]` — shows details for a specific idea
- `/hacky-hours random` — returns a random idea from the open pool
- `/hacky-hours pick [name]` — moves an idea from "Open Ideas" to "Closed Ideas"
- `/hacky-hours save` — saves a Slack thread as an idea (formats as markdown, pre-fills submit modal)

## Where — Platform and Delivery

- **Interface:** Slack slash commands and modals
- **Runtime:** Supabase Edge Functions (serverless Deno/TypeScript)
- **Storage:** Supabase Postgres with two tables: `open_ideas` and `closed_ideas`
- **No standalone UI** — everything happens inside Slack

## When — Timeline and Priority

MVP — first working version of the bot.

## Why — Value and Motivation

Hacky Hours sessions need a lightweight way to collect and surface project ideas. There's no structured way for community members to propose ideas ahead of time or browse what's available. This removes the friction so people show up knowing what they can work on.

---

## Constraints & Values

### Licensing Intent

MIT — copyright held by Empathetech. Matches hacky-hours-docs. Free and open source. No revenue model.

### Privacy Stance

Minimal data collection:
- Slack user ID (from the submitting user — no additional identity info)
- Idea name, description, features, timestamp

No emails, no auth tokens, no personal data stored beyond what Slack provides in the command payload. The Google Sheet is the only data store.

### Infrastructure Preference

Fully serverless via Supabase Edge Functions + Postgres. Zero maintenance — Supabase manages hosting. Each deployment connects to its own Slack workspace and Supabase project via environment variables. No Google account required.

### Accessibility Commitment

Slack handles UI accessibility for its own client. The bot's text responses should be clear, well-structured, and screen-reader friendly — no ASCII art or emoji-only content in responses.
