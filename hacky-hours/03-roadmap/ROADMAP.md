# ROADMAP.md

**Level 3 — Roadmap** | hacky-hours-bot

---

## MVP — Community members can submit, browse, and claim ideas through Slack

1. **Apps Script scaffold** — `doPost` entry point, command router that parses the slash command and dispatches to handler functions
2. **Request verification** — Slack signing secret (HMAC-SHA256) validation. Investigate Apps Script header access; implement fallback (verification token) if needed. Store secrets in Script Properties.
3. **Google Sheet integration** — connect to spreadsheet via `SPREADSHEET_ID` Script Property. Set up "Open Ideas" and "Closed Ideas" tabs with schema from DATA_MODEL.md.
4. **`/hacky-hours help`** — static Block Kit response listing all available commands. Validates the full round-trip (Slack → Apps Script → Slack).
5. **`/hacky-hours submit`** — two-way modal flow. Opens modal via `views.open`, handles `view_submission` payload. Validates duplicate names (returns modal error if taken). Writes to "Open Ideas" tab.
6. **`/hacky-hours list [page]`** — Block Kit formatted list of open ideas. 10 per page, default page 1. Footer shows "Page X of Y — use `/hacky-hours list N` for next page."
7. **`/hacky-hours get [name]`** — Block Kit formatted detail view of a single idea (name, submitter, description, features, submitted date).
8. **`/hacky-hours random`** — returns a random idea from the open pool, same detail format as `get`.
9. **`/hacky-hours pick [name]`** — moves idea from Open to Closed Ideas. Records `picked_by` (Slack user ID) and `picked_at` (timestamp). Returns confirmation with the idea details.
10. **README.md runbook** — step-by-step setup guide: fork repo, create Google Sheet, create Slack App (slash command, interactivity URL, bot token scopes), deploy Apps Script, set Script Properties, connect and test.

## V2+

11. **`/hacky-hours save`** — reads a Slack thread via `conversations.replies`, formats messages as markdown (username, timestamp, text), pre-fills the submit modal's description field. Requires additional bot scopes: `channels:history`, `groups:history`.
12. **Service account option** — alternative to deployer-account Sheet access. Runbook for both pathways with risk comparison. See SECURITY_PRIVACY.md.
13. **LLM-based thread synthesis** — optional enhancement to `save` that uses an LLM API to extract structured name/description/features from thread content. Adds an external API dependency and per-call cost.
