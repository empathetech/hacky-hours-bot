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
- [Node.js](https://nodejs.org) (v16+) — for the clasp CLI
- [Google Apps Script API](https://script.google.com/home/usersettings) enabled (toggle it on)

### Step 1: Fork and Clone

Fork this repo to your own GitHub account, then clone it locally:

```bash
git clone https://github.com/YOUR_USERNAME/hacky-hours-bot.git
cd hacky-hours-bot
```

### Step 2: Install and Authenticate clasp

[clasp](https://github.com/google/clasp) is Google's official CLI for Apps Script. It lets you push code from your local repo instead of copy-pasting in the browser.

```bash
npm install -g @google/clasp
clasp login
```

This opens a browser window to authenticate with your Google account. The credentials are saved locally in `~/.clasprc.json`.

### Step 3: Create the Apps Script Project

```bash
clasp create --type webapp --title "hacky-hours-bot"
```

This creates a new Apps Script project and generates a `.clasp.json` file pointing to it. The `.clasp.json` file is gitignored (it contains your project-specific ID).

> **Note:** If you already have an Apps Script project, copy `.clasp.json.example` to `.clasp.json` and replace `YOUR_APPS_SCRIPT_PROJECT_ID` with your project's Script ID. You can find it in the Apps Script editor under Project Settings → IDs.

### Step 4: Push Code to Apps Script

```bash
clasp push
```

This uploads all `.gs` files and `appsscript.json` from the `src/` directory to your Apps Script project. Run this every time you make code changes.

### Step 5: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "Hacky Hours Ideas"
3. Copy the **Spreadsheet ID** from the URL — it's the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_THE_SPREADSHEET_ID/edit
   ```

### Step 6: Set Script Properties

Script Properties are Apps Script's equivalent of environment variables — encrypted at rest, not visible in source code.

```bash
clasp open
```

This opens your Apps Script project in the browser. Then:

1. Click the gear icon (⚙️ Project Settings)
2. Scroll down to **Script Properties**
3. Add the following properties:

| Property | Value | Where to find it |
|----------|-------|-----------------|
| `SPREADSHEET_ID` | The ID from Step 5 | Google Sheets URL |
| `SLACK_VERIFICATION_TOKEN` | Your Slack app's verification token | (Created in Step 8) Slack App → Basic Information → Verification Token |
| `SLACK_BOT_TOKEN` | Your Slack bot's OAuth token | (Created in Step 8) Slack App → OAuth & Permissions → Bot User OAuth Token |

> **Important:** Never paste these values into source files or commit them to git.

### Step 7: Set Up Sheet Tabs

Run the one-time setup function to create the "Open Ideas" and "Closed Ideas" tabs:

```bash
clasp run setupSheetTabs
```

> **Note:** If `clasp run` fails with a permissions error, you may need to enable the Apps Script API and set up OAuth credentials. As a fallback, open the project with `clasp open`, select `setupSheetTabs` from the function dropdown, and click Run.

Check your Google Sheet — you should now have both tabs with header rows.

### Step 8: Create the Slack App

1. Go to [Slack API: Your Apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Name it "Hacky Hours" (or whatever you like) and select your workspace
4. After creation, you'll be on the app's **Basic Information** page

**Get the Verification Token:**
- On the Basic Information page, scroll to **App Credentials**
- Copy the **Verification Token**
- Set it as the `SLACK_VERIFICATION_TOKEN` Script Property (Step 6)

**Set up the Bot Token:**
1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Scopes → Bot Token Scopes** and add:
   - `commands`
   - `chat:write`
   - `channels:history` (required for `/hacky-hours save` in public channels)
   - `groups:history` (required for `/hacky-hours save` in private channels)
3. Scroll to the top and click **Install to Workspace**, then **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Set it as the `SLACK_BOT_TOKEN` Script Property (Step 6)

### Step 9: Deploy as a Web App

```bash
clasp deploy --description "hacky-hours-bot v1"
```

Copy the **Deployment ID** from the output. Then get your web app URL:

```bash
clasp open --webapp
```

This opens the deployed web app URL in your browser. Copy the URL from the address bar — you'll need it for Step 10.

> **Note:** The web app is accessible to "Anyone" (configured in `appsscript.json`). This is required so Slack can send requests to it. The verification token check ensures only legitimate Slack requests are processed.

### Step 10: Connect Slack to Apps Script

**Set up the Slash Command:**
1. In your Slack app settings, click **Slash Commands** in the left sidebar
2. Click **Create New Command**
3. Fill in:
   - **Command:** `/hacky-hours`
   - **Request URL:** The web app URL from Step 9
   - **Short Description:** "Submit, browse, and claim Hacky Hours ideas"
   - **Usage Hint:** "help | submit | list | get [name] | random | pick [name] | save"
4. Click **Save**

**Set up Interactivity (for modals):**
1. In the left sidebar, click **Interactivity & Shortcuts**
2. Toggle **Interactivity** to **On**
3. Set **Request URL** to the same web app URL from Step 9
4. Click **Save Changes**

### Step 11: Test

In your Slack workspace, type:

```
/hacky-hours help
```

You should see the command list. Then try:

```
/hacky-hours submit
```

A modal should open where you can submit a test idea.

## Development Workflow

### Making Changes

Edit the `.gs` files in `src/`, then push and deploy:

```bash
clasp push              # upload code to Apps Script
clasp deploy --description "description of changes"
```

The web app URL stays the same across deployments — no need to update Slack settings.

### Useful clasp Commands

| Command | What it does |
|---------|-------------|
| `clasp push` | Push local code to Apps Script |
| `clasp pull` | Pull code from Apps Script to local (overwrites local files) |
| `clasp open` | Open the Apps Script editor in your browser |
| `clasp open --webapp` | Open the deployed web app URL |
| `clasp deploy` | Create a new deployment version |
| `clasp deployments` | List all deployments |
| `clasp logs` | View recent execution logs |
| `clasp run <function>` | Run a function remotely |

### CI/CD with GitHub Actions

You can automate deployment on push to `main`. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Apps Script

on:
  push:
    branches: [main]
    paths: ['src/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install clasp
        run: npm install -g @google/clasp

      - name: Authenticate clasp
        run: echo '${{ secrets.CLASPRC_JSON }}' > ~/.clasprc.json

      - name: Configure project
        run: echo '${{ secrets.CLASP_JSON }}' > .clasp.json

      - name: Push and deploy
        run: |
          clasp push
          clasp deploy --description "Auto-deploy from commit ${{ github.sha }}"
```

**Required GitHub Secrets:**
- `CLASPRC_JSON` — contents of your `~/.clasprc.json` (OAuth refresh token)
- `CLASP_JSON` — contents of your `.clasp.json` (Apps Script project ID)

To set these up:
1. Run `cat ~/.clasprc.json` and copy the output
2. Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret
3. Name: `CLASPRC_JSON`, Value: paste the contents
4. Repeat for `CLASP_JSON` with the contents of your `.clasp.json`

> **Security note:** The `CLASPRC_JSON` contains an OAuth refresh token that grants access to your Google account's Apps Script projects. Treat it like a password — only store it in GitHub Secrets, never in code.

## Troubleshooting

**"Unauthorized" response:** Your `SLACK_VERIFICATION_TOKEN` in Script Properties doesn't match the token in your Slack app's Basic Information page. Double-check both values.

**Modal doesn't open:** Check that:
- `SLACK_BOT_TOKEN` is set correctly in Script Properties (starts with `xoxb-`)
- The bot has the `commands` and `chat:write` scopes
- The Interactivity Request URL matches your Apps Script web app URL

**"SPREADSHEET_ID not set" error:** Add the `SPREADSHEET_ID` to Script Properties (Step 6).

**Tabs not created:** Run `clasp run setupSheetTabs` or run the function manually from the Apps Script editor.

**`/hacky-hours save` not working:** Check that:
- You're running the command from **inside a thread** (not a top-level message)
- The bot has `channels:history` scope (and `groups:history` for private channels)
- The bot has been added to the channel (for private channels: invite the bot first)

**`clasp push` fails:** Make sure:
- You're authenticated (`clasp login`)
- The Apps Script API is enabled at https://script.google.com/home/usersettings
- `.clasp.json` exists and has a valid `scriptId`

**Changes not taking effect after `clasp push`:** You also need to run `clasp deploy` to create a new deployment version. Just pushing updates the project code but not the live web app.

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
