# Deployment Guide

> Last updated: 2026-03-20.

## Overview

The app runs on **Railway** with three services from a single codebase:

| Service | Type | Start command |
|---------|------|---------------|
| **web** | Next.js server | `npx drizzle-kit push && npm start` |
| **worker** | graphile-worker process | `npx tsx src/worker/index.ts` |
| **Postgres-JwGd** | Managed PostgreSQL | (managed by Railway) |

The web service runs `drizzle-kit push` on every deploy to apply any pending schema changes before starting Next.js. The worker process runs background jobs (campaign sending, script execution, churn detection).

## Railway Project

- **Project**: `pauseai-crm`
- **Project ID**: `d4b10f4b-d227-4a7a-a8a8-c3e8421183f9`
- **URL**: https://web-production-4523c.up.railway.app
- **Dashboard**: https://railway.com/project/d4b10f4b-d227-4a7a-a8a8-c3e8421183f9

### Service IDs

| Service | ID |
|---------|-----|
| web | `8875b979-e135-4264-b4ee-008df6089335` |
| worker | `1aca9bf6-97bb-4bfb-9f31-95fa9c666eab` |
| Postgres-JwGd | `bf86975f-4c53-4299-b386-3827fc3f1254` |

## Deploying

Both services deploy from local files using `railway up`. Because `railway.toml` defines the start command, you need to swap it per service.

### Deploy web

```bash
# 1. Set railway.toml for web
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"

[deploy]
startCommand = "npx drizzle-kit push && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF

# 2. Deploy
railway up --detach --service web
```

### Deploy worker

```bash
# 1. Set railway.toml for worker
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"

[deploy]
startCommand = "npx tsx src/worker/index.ts"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF

# 2. Deploy
railway up --detach --service worker
```

### Deploy both (quick script)

```bash
# Deploy web
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"

[deploy]
startCommand = "npx drizzle-kit push && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF
railway up --detach --service web

# Deploy worker
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"

[deploy]
startCommand = "npx tsx src/worker/index.ts"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF
railway up --detach --service worker
```

## Environment Variables

> **Tip:** Some credentials (MailerSend API key and from-email) can be managed directly in the app at **Settings → Integrations** without touching env vars or redeploying. DB-stored values take precedence over env vars.

### Web service

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection (uses Railway reference: `${{Postgres-JwGd.DATABASE_URL}}`) | Yes |
| `NEXTAUTH_SECRET` | Cryptographic secret for JWT sessions | Yes |
| `NEXTAUTH_URL` | Public URL of the web service | Yes |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Yes |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Yes |
| `MAILERSEND_API_KEY` | Mailersend API key fallback (prefer setting via **Settings → Integrations** in the UI) | No |
| `MAILERSEND_FROM_EMAIL` | From address fallback (prefer setting via **Settings → Integrations** in the UI) | No |
| `ADMIN_EMAILS` | Comma-separated emails auto-promoted to admin on sign-in | Recommended |
| `UNSUBSCRIBE_SECRET` | HMAC secret for unsubscribe tokens (`openssl rand -hex 32`) | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL used in unsubscribe links | Yes |
| `EMAIL_ENCRYPTION_KEY` | AES-256 key for encrypting Gmail OAuth tokens (`openssl rand -hex 32`) | Yes (if Gmail integration used) |
| `NODE_ENV` | Must be `production` | Yes |
| `DEV_BYPASS_AUTH` | Must be `false` in production (bypass only works when NODE_ENV=development) | No |

### Worker service

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection (same as web) | Yes |
| `MAILERSEND_API_KEY` | Mailersend API key fallback (prefer setting via the UI) | No |
| `MAILERSEND_FROM_EMAIL` | From address fallback (prefer setting via the UI) | No |
| `UNSUBSCRIBE_SECRET` | Same value as web — needed for unsubscribe URL generation during campaign sends | Yes |
| `NEXT_PUBLIC_APP_URL` | Same value as web — used in unsubscribe URLs | Yes |
| `EMAIL_ENCRYPTION_KEY` | Same value as web — needed for Gmail token decryption during sync | Yes (if Gmail integration used) |
| `NODE_ENV` | `production` | Yes |

### Setting variables

```bash
railway service web
railway variables set KEY=value

railway service worker
railway variables set KEY=value
```

## Checking Logs

```bash
# Web logs
railway service web && railway logs -n 50

# Worker logs
railway service worker && railway logs -n 50
```

## Authentication & Security

### Auth flow
1. Users sign in via **Google OAuth** at `/login`
2. Sessions use **JWT strategy** (stateless, no session table lookups)
3. Role stored in the `user` table (`role` column: `admin`, `member`, `viewer`) — this is the global role. Per-workspace roles are in `user_workspaces`.

### Admin auto-promotion
Emails listed in the `ADMIN_EMAILS` environment variable are automatically promoted to admin on their first sign-in. Currently configured: `maxime@pauseai.fr`.

### DEV_BYPASS_AUTH
This development convenience flag **only activates when both conditions are met**:
- `NODE_ENV === "development"`
- `DEV_BYPASS_AUTH === "true"`

In production (`NODE_ENV=production`), the bypass is **always inactive** regardless of the `DEV_BYPASS_AUTH` value. It is still good practice to set it to `false` or remove it in production.

### Google OAuth setup
The Google OAuth app must have the production URL registered as an authorized redirect URI:
```
https://web-production-4523c.up.railway.app/api/auth/callback/google
```

For Gmail integration, also add the Gmail OAuth callback:
```
https://web-production-4523c.up.railway.app/api/auth/gmail/callback
```

The Gmail API must be enabled in the Google Cloud project, and the OAuth consent screen must include the `gmail.readonly` scope.

Configure this in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

## Worker Jobs

| Task | Trigger | Description |
|------|---------|-------------|
| `send_campaign` | On-demand (enqueued by API) | Sends a campaign to all contacts in its segment |
| `run_script` | On-demand or scheduled | Executes a user-defined script in a sandboxed VM |
| `dispatch_scripts` | Cron: every minute (`* * * * *`) | Checks for enabled scripts with cron schedules and enqueues `run_script` jobs |
| `detect_churn` | Cron: daily at 6am UTC (`0 6 * * *`) | Flags dormant contacts based on inactivity |
| `sync_email_interactions` | On-demand (enqueued by dispatcher or manual refresh) | Fetches Gmail messages, matches to CRM contacts, creates interactions |
| `dispatch_email_syncs` | Cron: every minute (`* * * * *`) | Enqueues email connections whose sync interval has elapsed |

## Troubleshooting

### Worker failing with "Failed query: select ... from scripts"
The `scripts` table doesn't exist yet. Redeploy the web service — `drizzle-kit push` in its start command will create missing tables.

### "relation does not exist" errors
Run a web deploy to push schema changes: the web start command runs `drizzle-kit push` automatically.

### Google OAuth redirect error
Make sure `NEXTAUTH_URL` matches the actual public domain and that the redirect URI is registered in Google Cloud Console.

### Campaign stuck in "sending" status
The campaign was queued but the worker isn't running or failed mid-send. Check worker logs. The worker can be redeployed to restart processing.
