# PauseAI Everything App

A custom-built CRM and operational platform for [PauseAI Global](https://pauseai.info). Starts as a CRM, grows into the central hub for managing volunteers, campaigns, and outreach.

**Production:** https://web-production-4523c.up.railway.app
**Repo:** https://github.com/Maximophone/pauseai-everything

---

## What this is

A Next.js web app + background worker that replaces Airtable + manual email workflows. Core features:

- **Contacts** — spreadsheet-style table with inline editing, custom fields, tags, interaction history
- **Segments** — visual query builder to define dynamic audiences (e.g. "active members in France")
- **Campaigns** — compose and send broadcast emails to segments via Mailersend; schedule for later
- **Scripts** — write JavaScript automation scripts that run on a schedule or on demand (e.g. flag dormant contacts, bulk-update fields)
- **Settings** — manage custom fields, users, API keys

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
│   │   │   └── settings/       # Fields, users, API keys
│   │   ├── api/                # API route handlers
│   │   │   ├── contacts/
│   │   │   ├── campaigns/
│   │   │   ├── segments/
│   │   │   ├── scripts/
│   │   │   ├── tags/
│   │   │   ├── fields/
│   │   │   ├── users/
│   │   │   ├── api-keys/
│   │   │   └── webhooks/
│   │   └── login/
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
```

## Documentation

| Doc | What's in it |
|-----|-------------|
| [docs/development.md](docs/development.md) | Full local setup, env vars, database, tips |
| [docs/architecture.md](docs/architecture.md) | System design, data model, key patterns |
| [docs/deployment.md](docs/deployment.md) | Railway deployment, env vars, how to deploy each service |
| [docs/build-plan.md](docs/build-plan.md) | Build phases with completion status |
| [docs/features.md](docs/features.md) | Feature specs, backlog, and future ideas |

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
