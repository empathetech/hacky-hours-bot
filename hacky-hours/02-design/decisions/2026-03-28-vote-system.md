# ADR 2026-03-28: Vote System Design

## Status

Accepted

## Context

After shipping v0.3.1, the team wanted a way for Hacky Hours session participants to collectively decide which idea to work on. The initial assumption was a cumulative "like" system, but the actual need is a **session-scoped vote** — a facilitator calls a vote on one or more ideas, participants react, and a winner is selected.

## Decision

### Vote lifecycle
- Any channel member can call `/hacky-hours vote`, which opens a modal to select ideas, name the vote, and set an optional duration
- The bot posts a vote message; participants react with a designated emoji
- The caller runs `/hacky-hours close-vote [name]` to tally and determine the winner
- Ties are resolved by bot (random) or caller choice

### Reaction tracking via Events API
- Chose **Slack Events API** (option A — real-time event subscription) over polling `reactions.get` at close time (option B)
- Rationale: enables real-time validation (exclude caller, enforce active vote), better UX
- Tradeoff: new integration pattern (event subscriptions), new verification flow (url_verification challenge)

### Caller exclusion
- The vote caller cannot vote unless resolving a tiebreaker
- Prevents facilitator self-selection bias

### Concurrent vote limits
- Max 5 active votes (configurable via `MAX_OPEN_VOTES` env var)
- One active vote per idea name (reject duplicates)
- Expired votes cleaned up lazily on next interaction

### Scope split
- **v0.4.0:** Vote infrastructure (this ADR) — Slack + Supabase only
- **v0.5.0:** Post-vote actions (repo creation, scaffolding, issue seeding) — introduces GitHub API as new external service

## Consequences

- Edge Function now handles three payload types: slash commands, interaction payloads, and Events API events
- New Slack app configuration required: Event Subscriptions URL, `reaction_added`/`reaction_removed` subscriptions, `reactions:read` scope
- Two new database tables: `votes`, `vote_ideas`
- `MAX_OPEN_VOTES` adds the first configurable behavior limit (previous config was all credentials)
