# CHANGELOG

All notable changes to hacky-hours-bot are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
