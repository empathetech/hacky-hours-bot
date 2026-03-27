# CHANGELOG

All notable changes to hacky-hours-bot are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-03-26

### Added

- `/hacky-hours save` — reads a Slack thread, formats messages as markdown, and pre-fills the submit modal with the thread content. Must be run from inside a thread.
- Service account option for Google Sheet access — set `SERVICE_ACCOUNT_CREDENTIALS` in Script Properties to use a Google Cloud service account instead of the deployer's personal account. Includes full setup runbook in README.
- `channels:history` and `groups:history` bot scopes (required for `save` command)

### Changed

- Updated README.md with `save` command documentation, new bot scopes, service account setup guide, and troubleshooting for the `save` command
- Updated help command to include `save`

---

## [0.1.0] — 2026-03-26

### Added

- Apps Script scaffold with `doPost` entry point and command router
- Request verification via Slack Verification Token (stored in Script Properties)
- Google Sheets integration with `setupSheetTabs` helper for initial setup
- `/hacky-hours help` — Block Kit formatted command list
- `/hacky-hours submit` — modal flow with duplicate name validation
- `/hacky-hours list [page]` — paginated Block Kit list (10 ideas per page)
- `/hacky-hours get [name]` — Block Kit detail view of a single idea
- `/hacky-hours random` — random idea from the open pool
- `/hacky-hours pick [name]` — claim an idea, moves from Open to Closed Ideas with `picked_by` and `picked_at`
- README.md with complete setup runbook (Slack app, Google Sheet, Apps Script, Script Properties)
- MIT License (Copyright Empathetech)
- Hacky Hours framework documentation (Levels 1–4)

### Notes

- HMAC-SHA256 signing secret verification is not possible in Apps Script (no header access in `doPost`). Using deprecated verification token as fallback. See ARCHITECTURE.md for details.
- This is a template repo — fork and configure with your own Slack workspace and Google Sheet via Script Properties.
