# hacky-hours-bot

A Slack bot that lets community members submit, browse, and claim project ideas for Hacky Hours sessions. Uses Google Sheets as a backend and Google Apps Script as the runtime — no servers to deploy or maintain.

This is a **template repo** — fork it, configure your own Slack workspace and Google Sheet, and deploy. No hardcoded relationships with any particular accounts.

## Commands

| Command | Description |
|---------|-------------|
| `/hacky-hours help` | Show available commands |
| `/hacky-hours submit` | Submit a new idea (opens a modal) |
| `/hacky-hours list [page]` | Browse open ideas (10 per page) |
| `/hacky-hours get [name]` | View details for a specific idea |
| `/hacky-hours random` | Get a random idea from the open pool |
| `/hacky-hours pick [name]` | Claim an idea for your session |
| `/hacky-hours save` | Save a thread as an idea (run from inside a thread) |

## Architecture

```
Slack slash command → Google Apps Script web app → Google Sheets
```

The bot receives commands from Slack, reads/writes a Google Sheet, and responds with Block Kit formatted messages. For the `submit` command, it opens a Slack modal and handles the submission callback.

See [ARCHITECTURE.md](hacky-hours/02-design/ARCHITECTURE.md) for full details.

## Setup Guide

### Prerequisites

- A Google account
- A Slack workspace where you have permission to install apps
- [Google Apps Script](https://script.google.com) access (free with any Google account)

### Step 1: Fork and Clone

Fork this repo to your own GitHub account, then clone it locally:

```bash
git clone https://github.com/YOUR_USERNAME/hacky-hours-bot.git
```

### Step 2: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "Hacky Hours Ideas"
3. Copy the **Spreadsheet ID** from the URL — it's the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_THE_SPREADSHEET_ID/edit
   ```
4. Keep the Sheet open — the tabs will be created automatically in Step 4

### Step 3: Deploy the Apps Script

1. Go to [Google Apps Script](https://script.google.com) and create a new project
2. Name the project "hacky-hours-bot"
3. Delete the default `Code.gs` file
4. Create the following files and paste the contents from the `src/` directory in this repo:
   - `Main.gs` ← from `src/Main.gs`
   - `Commands.gs` ← from `src/Commands.gs`
   - `Sheets.gs` ← from `src/Sheets.gs`
   - `Slack.gs` ← from `src/Slack.gs`
5. Replace the default `appsscript.json` with the contents of `src/appsscript.json`:
   - In the Apps Script editor, click the gear icon (⚙️ Project Settings)
   - Check "Show 'appsscript.json' manifest file in editor"
   - Go back to the editor, open `appsscript.json`, and replace its contents

### Step 4: Set Script Properties

In the Apps Script editor:

1. Click the gear icon (⚙️ Project Settings)
2. Scroll down to **Script Properties**
3. Add the following properties:

| Property | Value | Where to find it |
|----------|-------|-----------------|
| `SPREADSHEET_ID` | The ID from Step 2 | Google Sheets URL |
| `SLACK_VERIFICATION_TOKEN` | Your Slack app's verification token | (Created in Step 5) Slack App → Basic Information → Verification Token |
| `SLACK_BOT_TOKEN` | Your Slack bot's OAuth token | (Created in Step 5) Slack App → OAuth & Permissions → Bot User OAuth Token |

> **Important:** Never paste these values into source files or commit them to git. Script Properties are encrypted at rest and only visible to the project owner.

### Step 5: Create the Slack App

1. Go to [Slack API: Your Apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Name it "Hacky Hours" (or whatever you like) and select your workspace
4. After creation, you'll be on the app's **Basic Information** page

**Get the Verification Token:**
- On the Basic Information page, scroll to **App Credentials**
- Copy the **Verification Token**
- Go back to Apps Script and set it as the `SLACK_VERIFICATION_TOKEN` Script Property (Step 4)

**Set up the Bot Token:**
1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Scopes → Bot Token Scopes** and add:
   - `commands`
   - `chat:write`
   - `channels:history` (required for `/hacky-hours save` in public channels)
   - `groups:history` (required for `/hacky-hours save` in private channels)
3. Scroll to the top and click **Install to Workspace**, then **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Go back to Apps Script and set it as the `SLACK_BOT_TOKEN` Script Property (Step 4)

### Step 6: Set Up Sheet Tabs

1. Go back to the Apps Script editor
2. In the function dropdown (top bar), select `setupSheetTabs`
3. Click **Run**
4. If prompted, authorize the script to access Google Sheets
5. Check your Google Sheet — you should now have "Open Ideas" and "Closed Ideas" tabs with header rows

### Step 7: Deploy the Apps Script as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Set:
   - **Description:** "hacky-hours-bot v1"
   - **Execute as:** "Me"
   - **Who has access:** "Anyone"
4. Click **Deploy**
5. Copy the **Web app URL** (you'll need this in Step 8)

> **Note:** "Anyone" means any HTTP request can reach the endpoint — this is required so Slack can send requests to it. The verification token check ensures only legitimate Slack requests are processed.

### Step 8: Connect Slack to Apps Script

**Set up the Slash Command:**
1. In your Slack app settings, click **Slash Commands** in the left sidebar
2. Click **Create New Command**
3. Fill in:
   - **Command:** `/hacky-hours`
   - **Request URL:** The web app URL from Step 7
   - **Short Description:** "Submit, browse, and claim Hacky Hours ideas"
   - **Usage Hint:** "help | submit | list | get [name] | random | pick [name] | save"
4. Click **Save**

**Set up Interactivity (for modals):**
1. In the left sidebar, click **Interactivity & Shortcuts**
2. Toggle **Interactivity** to **On**
3. Set **Request URL** to the same web app URL from Step 7
4. Click **Save Changes**

### Step 9: Test

In your Slack workspace, type:

```
/hacky-hours help
```

You should see the command list. Then try:

```
/hacky-hours submit
```

A modal should open where you can submit a test idea.

## Troubleshooting

**"Unauthorized" response:** Your `SLACK_VERIFICATION_TOKEN` in Script Properties doesn't match the token in your Slack app's Basic Information page. Double-check both values.

**Modal doesn't open:** Check that:
- `SLACK_BOT_TOKEN` is set correctly in Script Properties (starts with `xoxb-`)
- The bot has the `commands` and `chat:write` scopes
- The Interactivity Request URL matches your Apps Script web app URL

**"SPREADSHEET_ID not set" error:** Add the `SPREADSHEET_ID` to Script Properties (Step 4).

**Tabs not created:** Run the `setupSheetTabs` function manually from the Apps Script editor (Step 6).

**`/hacky-hours save` not working:** Check that:
- You're running the command from **inside a thread** (not a top-level message)
- The bot has `channels:history` scope (and `groups:history` for private channels)
- The bot has been added to the channel (for private channels: invite the bot first)

**Changes not taking effect:** After editing code in Apps Script, you must create a **new deployment** (Deploy → New deployment) or update the existing one (Deploy → Manage deployments → edit → update version). The web app URL stays the same when updating.

## Service Account Setup (Optional)

By default, the bot accesses Google Sheets using the deployer's Google account. For tighter isolation — especially in team environments — you can use a Google Cloud service account instead.

**When to use a service account:**
- The bot shouldn't be tied to one person's Google account
- You want the service account to be the sole accessor of the Sheet
- Multiple people manage the bot and you don't want to share a personal account

**Tradeoffs vs. deployer account:**
- Tighter isolation (service account only accesses what you share with it)
- More setup (requires a Google Cloud project)
- Better for teams (not tied to one person)

### Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a new project (or use an existing one)
2. Enable the **Google Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable
3. Create a service account: IAM & Admin → Service Accounts → Create Service Account
   - Name: "hacky-hours-bot" (or whatever you like)
   - No roles needed (it only accesses Sheets you explicitly share with it)
4. Create a key: click the service account → Keys → Add Key → JSON
   - A JSON file will download — this contains the credentials
5. Share your Google Sheet with the service account's email address (found in the JSON as `client_email`) — give it **Editor** access
6. In the Apps Script editor, add a new Script Property:
   - **Property:** `SERVICE_ACCOUNT_CREDENTIALS`
   - **Value:** paste the entire contents of the downloaded JSON file

> **Important:** The JSON credentials contain a private key. Never commit this to git or share it. Store it only in Script Properties.

When `SERVICE_ACCOUNT_CREDENTIALS` is set, the bot will use the service account to verify Sheet access. If it's not set, the bot falls back to the deployer's account (the default behavior).

See [SECURITY_PRIVACY.md](hacky-hours/02-design/SECURITY_PRIVACY.md) for a detailed risk comparison.

## Updating After Code Changes

When you modify the Apps Script code:

1. Open the Apps Script editor
2. Click **Deploy → Manage deployments**
3. Click the pencil icon (✏️) on your active deployment
4. Under **Version**, select "New version"
5. Click **Deploy**

The web app URL stays the same — no need to update Slack settings.

## License

MIT — Copyright Empathetech. See [LICENSE](LICENSE) for details.

## Design Documentation

This project uses the [Hacky Hours framework](https://github.com/empathetech/hacky-hours-docs) for documentation:

- [Product Overview](hacky-hours/01-ideate/PRODUCT_OVERVIEW.md)
- [Architecture](hacky-hours/02-design/ARCHITECTURE.md)
- [Data Model](hacky-hours/02-design/DATA_MODEL.md)
- [Security & Privacy](hacky-hours/02-design/SECURITY_PRIVACY.md)
- [Licensing](hacky-hours/02-design/LICENSING.md)
- [Roadmap](hacky-hours/03-roadmap/ROADMAP.md)
