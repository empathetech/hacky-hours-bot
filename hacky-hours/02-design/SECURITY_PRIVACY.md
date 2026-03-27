# SECURITY_PRIVACY.md

**Level 2 — Design** | hacky-hours-bot

---

## Data Inventory

| Data | Source | Stored where | Purpose |
|------|--------|-------------|---------|
| Slack user ID | Slack command payload (`user_id`) | Google Sheet | Identifies who submitted or picked an idea |
| Idea name | User input (modal) | Google Sheet | Lookup key for `get` and `pick` |
| Idea description | User input (modal) | Google Sheet | What the idea is about |
| Idea features | User input (modal) | Google Sheet | Desired scope / features |
| Submitted timestamp | Auto-generated | Google Sheet | When the idea was created |
| Picked-by user ID | Slack command payload (`user_id`) | Google Sheet | Who claimed the idea |
| Picked timestamp | Auto-generated | Google Sheet | When the idea was claimed |

**What we don't store:** emails, passwords, display names, profile photos, auth tokens, or any PII beyond Slack user IDs.

---

## Authentication & Authorization

**Authentication:** All requests are verified via Slack Verification Token (static token comparison). HMAC-SHA256 signing secret verification is not possible in Apps Script because `doPost(e)` does not expose HTTP headers. See ARCHITECTURE.md — Request Verification for details and accepted risk analysis.

**Authorization:** None — any member of the Slack workspace can use all commands. No admin vs. user roles. Anyone can submit, list, get, random, or pick. The `picked_by` field tracks who claimed an idea, but there's no restriction on who can do it.

**V2 note:** The `save` command will require `channels:history` and `groups:history` scopes, granting the bot read access to channel messages. This is a broader permission than the MVP commands need. The runbook should explain this scope expansion clearly when documenting V2 setup.

---

## Google Sheet Access Model

### MVP — Apps Script Runs as Deployer

The Apps Script runs under the deployer's Google account. The deployer owns both the script and the Sheet. No service account or extra credentials needed.

**Sheet sharing:**
- The Sheet should be **restricted by default** — no sharing link, no additional collaborators.
- The Slack bot is the only writer. All reads and writes go through the bot.
- **Viewing the Sheet directly is an independent decision.** The deployer can share view-only access with specific people or via link for transparency/auditing purposes. The bot doesn't depend on or enforce this.

**Risk:** The deployer's Google account is the single point of trust. If their account is compromised, the Sheet and script are exposed. Acceptable for a community tool; the data sensitivity is low (idea names and Slack user IDs).

### V2 — Service Account Option

A future version should offer a **service account pathway** as an alternative:
- Create a Google Cloud service account
- Share the Sheet with the service account email (editor access)
- Use the service account credentials in Apps Script

**Tradeoffs vs. deployer account:**
- **Tighter isolation** — the service account only accesses what you explicitly share with it, separate from any personal Google account
- **More setup** — requires a Google Cloud project, credentials JSON, OAuth configuration
- **Better for teams** — the bot isn't tied to one person's account

V2 should document both pathways with runbooks and a clear comparison of risk levels so deployers can choose.

---

## Threat Surface

| Threat | Mitigation |
|--------|-----------|
| Unauthenticated requests to the Apps Script URL | Verification token rejects requests without a valid token |
| Slack user ID spoofing | Not possible — `user_id` comes from Slack's verified payload, not user input |
| Replay attacks | Not mitigated — verification tokens have no replay protection. Accepted risk given low data sensitivity. |
| Sheet data exposure | Sheet restricted by default; sharing is an independent deployer decision |
| Deployer account compromise | Low-sensitivity data (idea names, Slack user IDs). V2 service account option reduces this risk. |
| Apps Script URL leaked | Without the signing secret, requests are rejected. URL alone is not sufficient to read or write data. |

---

## Input Validation

All user input comes through Slack modals, which provide basic constraints (required fields, character limits). Apps Script should additionally:

- **Sanitize idea names** before using them as lookup keys (trim whitespace, reject empty strings after trim)
- **Enforce the duplicate name check** on submit (see DATA_MODEL.md — Constraints)
- **Do not log or echo raw user input in error messages** — return generic errors to Slack, log details to Apps Script's execution log (which is only visible to the deployer)

---

## Secrets Management

All secrets live in **Google Apps Script Script Properties** (encrypted at rest, not visible in source code):

| Secret | Purpose |
|--------|---------|
| `SLACK_VERIFICATION_TOKEN` | Request verification |
| `SLACK_BOT_TOKEN` | Calling Slack API (modals, messages) |
| `SPREADSHEET_ID` | Target Google Sheet |

**Never commit these to the repo.** The README runbook must make this clear. The `.gitignore` should not need to cover these since they live in Script Properties, not in files — but the runbook should explicitly warn against pasting them into source files.
