# LICENSING.md

**Level 2 — Design** | hacky-hours-bot

---

## License

**MIT License** — copyright held by **Empathetech**.

- Free to use, modify, and distribute
- No revenue model
- Matches [hacky-hours-docs](https://github.com/empathetech/hacky-hours-docs) licensing

The `LICENSE` file in the repo root must reflect this.

---

## Dependencies

None. Google Apps Script has no package manager — there are no third-party libraries to evaluate for license compatibility.

**External services accessed via HTTP:**
- **Slack API** — used under Slack's API Terms of Service
- **Google Sheets API** — accessed through Apps Script's built-in `SpreadsheetApp` (no separate library)

Neither introduces a licensing concern for the project itself.

---

## Slack API Terms of Service

Slack apps must comply with the [Slack API Terms of Service](https://api.slack.com/terms-of-service). This bot's design does not conflict with those terms — it processes only the data Slack sends in command payloads, stores minimal information (user IDs, idea text), and does not resell or redistribute Slack data.

Deployers who fork this repo and run their own instance are responsible for their own compliance with Slack's terms.

---

## Contributor Licensing

This is an open-source community project under MIT. No Contributor License Agreement (CLA) is required. Contributions are accepted under the same MIT license as the project.
