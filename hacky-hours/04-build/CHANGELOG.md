# CHANGELOG

All notable changes to hacky-hours-bot are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] — 2026-03-26

### Changed — Architecture rewrite (Apps Script → Supabase)

This release replaces the entire runtime and storage layer. All Slack-facing behavior is identical.

See [ADR 2026-03-26: Switch to Supabase](../02-design/decisions/2026-03-26-switch-to-supabase.md) for the full decision record.

**Runtime:** Google Apps Script → Supabase Edge Function (Deno/TypeScript)
**Storage:** Google Sheets → Supabase Postgres
**Verification:** Deprecated verification token → HMAC-SHA256 signing secret (Slack's recommended best practice)

### Added

- SQL migration with Row Level Security (default deny for `anon` key)
- HMAC-SHA256 request verification with replay protection (5-minute window)
- Supabase Edge Function with all commands: help, submit, list, get, random, pick, save
- Duplicate name validation via Postgres UNIQUE constraint (database-level enforcement)
- Case-insensitive name lookup via `ilike`
- CI/CD instructions with GitHub Actions (Supabase CLI)
- Security section in README with defense-in-depth overview
- Local development workflow (`supabase start`, `supabase functions serve`)
- RLS verification step in setup guide

### Removed

- Google Apps Script code (archived to `hacky-hours/archive/apps-script/`)
- Google Sheets dependency (no Google account needed)
- clasp CLI dependency
- Service account option (no longer needed — Supabase project isolation replaces it)
- Deprecated Slack verification token (replaced by signing secret)

---

## [0.2.1] — 2026-03-26

### Changed

- Replaced manual copy-paste deployment with [clasp](https://github.com/google/clasp) CLI workflow
- Added `.clasp.json.example` template for per-deployment configuration
- Added `.clasp.json` and `.clasprc.json` to `.gitignore`
- Rewrote README setup guide to use clasp for all Apps Script operations (push, deploy, open, run)
- Added "Development Workflow" section with common clasp commands
- Added CI/CD instructions with GitHub Actions auto-deploy example
- Added clasp-specific troubleshooting entries

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
