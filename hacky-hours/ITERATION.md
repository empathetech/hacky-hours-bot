# ITERATION.md — Initial Feature Capture

## Raw Capture

### Slack Bot Integration

**Goal:** Create a `/hacky-hours` Slack bot for workspaces that lets community members submit, browse, and claim project ideas — with Google Sheets as the lightweight backend.

**Commands:**
- `/hacky-hours submit` — opens a UI modal to create a new idea (name, submitter, description, features) → saves to "Open Ideas" tab in a Google Sheet
- `/hacky-hours list` — lists all ideas from the "Open Ideas" tab
- `/hacky-hours get [name]` — shows details for a specific idea
- `/hacky-hours random` — returns a random idea from the open pool
- `/hacky-hours pick [name]` — moves an idea from "Open Ideas" to "Closed Ideas" tab

**Constraints:**
- Super lightweight — nothing to deploy/maintain if possible
- Only permission needed: access to a specific Google Sheets spreadsheet
- Submitter identified by Slack user
- Google Apps Script as the runtime (runs on Google's infra, no server needed)

**Storage:**
- Google Sheets spreadsheet with two tabs: "Open Ideas" and "Closed Ideas"
- Each row: name, Slack user, description, features, timestamp

**Architecture (proposed):**
- Slack slash command → Google Apps Script web app → Google Sheets
- Apps Script deployed as a web app (one-click deploy, Google manages hosting)
- Slack app configured with the Apps Script URL as the request endpoint

**Open Questions:**
- Google account ownership (Empathetech service account? personal?)
- Slack app distribution (single workspace or installable by any community?)
- Licensing (MIT to match hacky-hours-docs?)
