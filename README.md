# PauseAI Everything App

A custom-built CRM and operational platform for [PauseAI Global](https://pauseai.info). Starts as a CRM, grows into the central hub for managing volunteers, campaigns, and outreach. Supports multi-tenancy via workspaces for PauseAI Global and national chapters.

**Production:** https://web-production-4523c.up.railway.app
**Repo:** https://github.com/Maximophone/pauseai-everything

---

## What this is

A Next.js web app + background worker that replaces Airtable + manual email workflows. Core features:

- **Workspaces** — multi-tenant architecture with a global workspace (PauseAI Global) and chapter workspaces (e.g., Pause IA France). Each workspace has its own contacts, tags, fields, segments, campaigns, communication categories, and team members. Workspace switcher in the sidebar for users belonging to multiple workspaces.
- **Contacts** — spreadsheet-style table with inline editing, custom fields, tags, interaction history. Contacts are scoped to workspaces — each workspace sees only its own contacts. A contact can belong to multiple workspaces.
- **Segments** — visual query builder to define dynamic audiences (e.g. "contacts with tag 'parisien'"). Segments are workspace-scoped.
- **Campaigns** — compose and send broadcast emails to segments via Mailersend; schedule for later; assign email categories for preference-based filtering
- **Communication preferences** — three-state subscription model (subscribed/unsubscribed/neutral) per workspace per category; contacts must be explicitly subscribed to receive categorized emails; public unsubscribe page with preference center; HMAC-signed unsubscribe links; `{{unsubscribe}}` merge variable for in-body links
- **Scripts** — write JavaScript automation scripts that run on a schedule or on demand (e.g. flag dormant contacts, bulk-update fields)
- **Settings** — manage workspaces, custom fields, users (per-workspace), API keys, email categories, app-level settings
- **My Email Contacts** — connect your personal Gmail account to browse email contacts, import them to the workspace, and auto-log email interactions on contact timelines. User-scoped connections with per-contact sync/visibility settings, encrypted OAuth tokens, and worker-based periodic sync.
- **Role-based access** — two-layer role system (global + workspace roles) with invite-only login via Google OAuth

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | PostgreSQL via Drizzle ORM |
| Job queue | graphile-worker (Postgres-backed) |
| UI | shadcn/ui + Tailwind CSS + AG Grid (Community) |
| Auth | Auth.js v5 (Google OAuth) |
| Email | Mailersend API |
| Hosting | Railway (web + worker + Postgres) |
| Tests | Vitest |

## Quick start (local dev)

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or use Docker: `docker-compose up -d`)

### 1. Clone and install

```bash
git clone https://github.com/Maximophone/pauseai-everything.git
cd pauseai-everything
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — see [docs/development.md](docs/development.md) for what each variable does and how to get them.

Minimum required for local dev:
```
DATABASE_URL=postgresql://localhost:5432/pauseai
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
DEV_BYPASS_AUTH=true   # skip Google login in development
ADMIN_EMAILS=you@example.com   # auto-promote to admin
UNSUBSCRIBE_SECRET=...         # openssl rand -hex 32
EMAIL_ENCRYPTION_KEY=...       # openssl rand -hex 32 (for Gmail OAuth token encryption)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up the database

```bash
npm run db:generate    # generate migration files (if schema changed)
npx drizzle-kit push   # push schema to local Postgres (no migration files needed in dev)
```

### 4. Run the app

```bash
# Web server (Next.js)
npm run dev

# Background worker (in a separate terminal)
npm run worker
```

Open http://localhost:3000.

With `DEV_BYPASS_AUTH=true`, you'll be logged in automatically as "Dev User" with admin access — no Google setup needed.

---

## Project structure

```
pauseai-everything/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # All authenticated pages
│   │   │   ├── contacts/       # Contact list + detail pages
│   │   │   ├── email/          # Campaigns
│   │   │   ├── segments/       # Segment builder
│   │   │   ├── automations/    # Script editor (JS automation)
│   │   │   ├── my-email-contacts/ # Gmail integration (personal email contacts)
│   │   │   └── settings/       # Workspaces, fields, users, API keys, email categories
│   │   ├── api/                # API route handlers
│   │   │   ├── contacts/
│   │   │   ├── campaigns/
│   │   │   ├── segments/
│   │   │   ├── scripts/
│   │   │   ├── tags/
│   │   │   ├── fields/
│   │   │   ├── users/
│   │   │   ├── api-keys/
│   │   │   ├── communication-categories/
│   │   │   ├── auth/gmail/         # Gmail OAuth flow
│   │   │   ├── email-connections/  # Email connection CRUD + contacts + import
│   │   │   ├── email-contact-settings/ # Per-contact sync settings
│   │   │   ├── settings/
│   │   │   ├── unsubscribe/
│   │   │   └── webhooks/
│   │   ├── login/
│   │   └── unsubscribe/        # Public unsubscribe preference center
│   ├── components/             # React components
│   ├── db/
│   │   └── schema/             # Drizzle table definitions
│   ├── lib/                    # Business logic (no React)
│   └── worker/
│       ├── index.ts            # Worker entry point
│       └── tasks/              # One file per background job type
├── docs/                       # Documentation
│   ├── architecture.md         # System design and patterns
│   ├── build-plan.md           # Phase-by-phase build roadmap + status
│   ├── deployment.md           # Railway deployment guide
│   ├── development.md          # Local development setup
│   └── features.md             # Feature specs and backlog
├── .env.example
├── railway.toml                # Worker service start command (for Railway deploys)
└── drizzle.config.ts
```

## Key commands

```bash
npm run dev           # Next.js dev server (http://localhost:3000)
npm run worker        # Background worker
npm run build         # Production build
npm run test          # Run Vitest tests
npm run test:watch    # Watch mode

npm run db:generate   # Generate Drizzle migration files
npm run db:migrate    # Apply migration files
npm run db:studio     # Open Drizzle Studio (DB browser)
npm run db:seed       # Seed with sample data

npm run docs:api      # Regenerate docs/api-reference.md from Zod schemas
```

## Documentation

| Doc | What's in it |
|-----|-------------|
| [docs/api-reference.md](docs/api-reference.md) | Full REST API reference — all endpoints, request/response shapes, auth levels (auto-generated) |
| [docs/development.md](docs/development.md) | Full local setup, env vars, database, tips |
| [docs/architecture.md](docs/architecture.md) | System design, data model, key patterns |
| [docs/deployment.md](docs/deployment.md) | Railway deployment, env vars, how to deploy each service |
| [docs/build-plan.md](docs/build-plan.md) | Build phases with completion status |
| [docs/features.md](docs/features.md) | Feature specs, backlog, and future ideas |
| [docs/workspaces.md](docs/workspaces.md) | Multi-tenancy (workspaces) design specification |
| [docs/gmail-integration.md](docs/gmail-integration.md) | Gmail / personal email integration design doc |
| [docs/future-features.md](docs/future-features.md) | Out-of-scope ideas captured for later |

## Auth & Permissions

**Invite-only access** — users must be invited by an admin before they can sign in with Google. Uninvited emails are rejected at login.

**Two-layer role system:**

Users have a **global role** (system-wide) and a **workspace role** (per-workspace). The effective role in any workspace is the maximum of the two. For example, a user with global "member" role and workspace "admin" role is effectively an admin in that workspace.

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Admin** | Manage users, settings, campaigns, scripts, segments, fields, contacts within their workspace | — |
| **Member** | View/edit contacts, tags, interactions | Send campaigns, manage segments/scripts/fields, access settings |
| **Viewer** | View all data (read-only) | Create, edit, or delete anything |

**Global admins** additionally can: create/delete workspaces, define core and global_internal custom fields, view all workspaces.

- Workspace roles assigned by workspace admins in Settings > Users
- Global roles managed by global admins
- `ADMIN_EMAILS` env var auto-promotes specified emails to global admin
- API key auth (`Bearer pai_<key>`) grants admin access
- All API routes enforce role checks server-side; UI buttons are disabled for insufficient roles

## Deployment

Deployed on Railway with three services: **web**, **worker**, **Postgres**. See [docs/deployment.md](docs/deployment.md) for the full guide.

**Current production URL:** https://web-production-4523c.up.railway.app

To deploy:
```bash
# Deploy web service
cat > railway.toml << 'EOF'
[build]
builder = "RAILPACK"
[deploy]
startCommand = "npx drizzle-kit push && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
EOF
railway up --detach --service web

# Deploy worker service
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

## Contributing

See [docs/development.md](docs/development.md) for the full development guide including how to add new features, database schema changes, and testing conventions.
