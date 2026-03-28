# hacky-hours-bot

A Slack bot that lets community members submit, browse, and claim project ideas for Hacky Hours sessions. Uses Supabase (Postgres + Edge Functions) as the backend — no servers to deploy or maintain.

This is a **template repo** — fork it, configure your own Slack workspace and Supabase project, and deploy. No hardcoded relationships with any particular accounts.

## Commands

| Command | Description |
|---------|-------------|
| `/hacky-hours help` | Show available commands |
| `/hacky-hours submit` | Submit a new idea (opens a modal) |
| `/hacky-hours list [page]` | Browse open ideas (10 per page) |
| `/hacky-hours get [name]` | View details for a specific idea |
| `/hacky-hours random` | Get a random idea from the open pool |
| `/hacky-hours pick [name]` | Claim an idea for your session |
| `/hacky-hours save [thread-link]` | Save a thread as an idea |
| `/hacky-hours vote` | Start a vote on one or more ideas (opens a modal) |
| `/hacky-hours close-vote [name]` | Close a vote and pick the winner |

## Architecture

```
Slack slash command → Supabase Edge Function → Supabase Postgres
```

The bot receives commands from Slack via a serverless Edge Function (Deno/TypeScript), reads/writes a Postgres database, and responds with Block Kit formatted messages. Request verification uses HMAC-SHA256 (Slack's recommended best practice). Row Level Security (RLS) is enabled on all tables.

See [ARCHITECTURE.md](hacky-hours/02-design/ARCHITECTURE.md) for full details.

## Setup Guide

### Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- A Slack workspace where you have permission to install apps
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed:
  ```bash
  # macOS
  brew install supabase/tap/supabase

  # npm (any platform)
  npm install -g supabase
  ```

### Step 1: Fork and Clone

Fork this repo to your own GitHub account, then clone it locally:

```bash
git clone https://github.com/YOUR_USERNAME/hacky-hours-bot.git
cd hacky-hours-bot
```

### Step 2: Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New Project**
2. Name it "hacky-hours-bot" (or whatever you like)
3. Set a database password (save it somewhere safe — you won't need it for this setup, but you'll need it if you ever connect directly)
4. Choose a region close to your users
5. Click **Create new project** and wait for it to provision

### Step 3: Link Your Local Repo to Supabase

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is the string in your Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### Step 4: Run Database Migrations

This creates the `open_ideas` and `closed_ideas` tables with Row Level Security:

```bash
supabase db push
```

**Verify RLS is working:** Go to the Supabase dashboard → SQL Editor and run:

```sql
SET role anon;
SELECT * FROM open_ideas;
RESET role;
```

This should return **zero rows** even if there's data — confirming the `anon` key has no access.

### Step 5: Create the Slack App

1. Go to [Slack API: Your Apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Name it "Hacky Hours" (or whatever you like) and select your workspace

**Get the Signing Secret:**
- On the Basic Information page, scroll to **App Credentials**
- Copy the **Signing Secret** (not the verification token — we use the more secure HMAC-SHA256 method)

**Set up the Bot Token:**
1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Scopes → Bot Token Scopes** and add:
   - `commands`
   - `chat:write`
   - `channels:history` (required for `/hacky-hours save` in public channels)
   - `groups:history` (required for `/hacky-hours save` in private channels)
   - `reactions:read` (required for vote tallying)
   - `reactions:write` (required for seeding vote emoji prompts)
3. Scroll to the top and click **Install to Workspace**, then **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Step 6: Set Environment Variables

Store your Slack secrets as Supabase Edge Function secrets:

```bash
supabase secrets set SLACK_SIGNING_SECRET=your_signing_secret_here
supabase secrets set SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

> **Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions — you don't need to set them.

### Step 7: Deploy the Edge Function

```bash
supabase functions deploy hacky-hours --no-verify-jwt
```

The `--no-verify-jwt` flag is required because Slack sends requests without a Supabase JWT. We verify requests using the Slack signing secret instead.

Copy the function URL from the output — it will look like:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/hacky-hours
```

### Step 8: Connect Slack to Supabase

**Set up the Slash Command:**
1. In your Slack app settings, click **Slash Commands** in the left sidebar
2. Click **Create New Command**
3. Fill in:
   - **Command:** `/hacky-hours`
   - **Request URL:** The Edge Function URL from Step 7
   - **Short Description:** "Submit, browse, and claim Hacky Hours ideas"
   - **Usage Hint:** "help | submit | list | get [name] | random | pick [name] | save [link] | vote | close-vote [name]"
4. Click **Save**

**Set up Interactivity (for modals):**
1. In the left sidebar, click **Interactivity & Shortcuts**
2. Toggle **Interactivity** to **On**
3. Set **Request URL** to the same Edge Function URL from Step 7
4. Click **Save Changes**

**Set up Event Subscriptions (for vote reactions):**
1. In the left sidebar, click **Event Subscriptions**
2. Toggle **Enable Events** to **On**
3. Set **Request URL** to the same Edge Function URL — Slack will send a verification challenge; the bot handles this automatically
4. Under **Subscribe to bot events**, add:
   - `reaction_added`
   - `reaction_removed`
5. Click **Save Changes**
6. **Reinstall the app** — go to OAuth & Permissions → Reinstall to Workspace (required after adding events)

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

## Development Workflow

### Local Development

```bash
supabase start                          # start local Supabase stack
supabase functions serve hacky-hours    # serve the function locally with hot reload
```

Use a tool like [ngrok](https://ngrok.com) to expose your local function to Slack for testing:

```bash
ngrok http 54321
```

Then update your Slack app's Request URLs to point to the ngrok URL.

### Deploying Changes

```bash
supabase functions deploy hacky-hours --no-verify-jwt
```

The function URL stays the same — no need to update Slack settings.

### Database Migrations

```bash
supabase migration new my_change_name   # create a new migration file
# edit the file in supabase/migrations/
supabase db push                        # apply to remote database
supabase db reset                       # reset local database to migrations
```

### Useful Commands

| Command | What it does |
|---------|-------------|
| `supabase functions deploy hacky-hours --no-verify-jwt` | Deploy the Edge Function |
| `supabase functions serve hacky-hours` | Run locally with hot reload |
| `supabase functions logs hacky-hours` | View function logs |
| `supabase db push` | Apply migrations to remote database |
| `supabase db reset` | Reset local database to match migrations |
| `supabase secrets list` | List configured secrets |
| `supabase secrets set KEY=value` | Set a secret |

### CI/CD with GitHub Actions

Automate deployment on push to `main`. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Supabase

on:
  push:
    branches: [main]
    paths: ['supabase/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1

      - name: Link project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Push migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Deploy function
        run: supabase functions deploy hacky-hours --no-verify-jwt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Required GitHub Secrets:**
- `SUPABASE_ACCESS_TOKEN` — your Supabase personal access token (dashboard → Account → Access Tokens)
- `SUPABASE_PROJECT_REF` — your project reference ID

## Security

This bot implements defense-in-depth:

1. **Request verification:** HMAC-SHA256 signing secret with replay protection (rejects requests older than 5 minutes)
2. **Database access:** Row Level Security enabled with default deny — the `anon` key has zero access
3. **Secrets management:** All secrets stored as Supabase Edge Function environment variables — never in code
4. **Input validation:** Parameterized queries via Supabase client library, name uniqueness enforced at the database level

See [SECURITY_PRIVACY.md](hacky-hours/02-design/SECURITY_PRIVACY.md) for the full threat model.

## Troubleshooting

**"Unauthorized" response:** Your `SLACK_SIGNING_SECRET` doesn't match. Run `supabase secrets list` to verify it's set, and compare against your Slack app's Basic Information → Signing Secret.

**Modal doesn't open:** Check that:
- `SLACK_BOT_TOKEN` is set correctly (`supabase secrets list`)
- The bot has `commands` and `chat:write` scopes
- The Interactivity Request URL matches your Edge Function URL

**Database errors:** Run `supabase db push` to ensure migrations are applied. Check the Supabase dashboard → Table Editor to see if the tables exist.

**`/hacky-hours save` not working:** Check that:
- You're passing a thread link: right-click a message in the thread → *Copy link*, then `/hacky-hours save <link>`
- The bot has `channels:history` scope (and `groups:history` for private channels)
- The bot has been added to the channel (for private channels: invite the bot first)

**Function not responding:** Check logs with `supabase functions logs hacky-hours`. Common issues:
- Missing secrets (run `supabase secrets list`)
- Deployment didn't complete (redeploy with `supabase functions deploy hacky-hours --no-verify-jwt`)

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
