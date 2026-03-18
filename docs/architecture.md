# PauseAI Everything App — Architecture

> Living document. Last updated: 2026-03-18.

## Vision

A custom-built platform for PauseAI Global that starts as a CRM and grows into the central operational hub for the organization. Built incrementally, designed to be extended.

## System boundaries

```
┌─────────────────────────────────────────────────────┐
│                 PauseAI Everything App               │
│                                                      │
│  Contacts, lifecycle stages, interactions,           │
│  segments, campaigns, email orchestration,           │
│  admin dashboard, background jobs, scripts           │
└──────────┬──────────────┬───────────────┬────────────┘
           │              │               │
     ┌─────▼─────┐ ┌─────▼─────┐  ┌──────▼──────┐
     │ Mailersend│ │   Tally   │  │   Notion    │
     │ (email)   │ │ (forms)   │  │ (docs/wiki) │
     └───────────┘ └───────────┘  └─────────────┘
```

**The app owns:**
- All contact/member data (source of truth)
- Lifecycle stages and transitions
- Interaction history
- Segments and tags
- Email campaign orchestration (compose, target, schedule, track)
- Background jobs and automations (JavaScript scripts with cron scheduling)

**External services:**
- **Mailersend** — sends the actual emails
- **Tally** — collects form submissions via webhooks
- **Notion** — stays as docs/wiki, not a data store

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | Best AI coding support, huge ecosystem, handles both UI and API |
| Language | TypeScript | Type safety, good DX |
| Database | PostgreSQL | Relational data + JSONB for flexible fields |
| Job queue | graphile-worker | Postgres-backed — no extra infrastructure |
| ORM | Drizzle | Close to SQL, excellent JSONB support |
| UI | shadcn/ui + @base-ui/react + Tailwind | Composable primitives |
| Table | AG Grid Community | Inline editing, filtering, free |
| Auth | Auth.js v5 (NextAuth) | Google OAuth, JWT sessions |
| Email | Mailersend API | Already in use |
| Hosting | Railway | Web + worker + Postgres, push-to-deploy |
| Tests | Vitest | Fast, TypeScript-native |

## Architecture: Web + Worker

Two processes from the same codebase, sharing the same Postgres database.

```
┌──────────────────────────────────────┐
│            Web Process               │
│         (Next.js server)             │
│                                      │
│  Pages: /dashboard/**               │
│  API:   /api/**                     │
│                                      │
│  On user action or webhook:          │
│  → enqueues jobs to Postgres queue   │
└─────────────────┬────────────────────┘
                  │
            Postgres DB
          (data + job queue)
                  │
┌─────────────────┴────────────────────┐
│           Worker Process             │
│     (long-running Node process)      │
│                                      │
│  Tasks:                              │
│  - send_campaign                     │
│  - run_script                        │
│  - detect_churn                      │
│                                      │
│  Cron jobs (every minute):           │
│  - dispatch_campaigns                │
│  - dispatch_scripts                  │
│                                      │
│  Cron jobs (daily):                  │
│  - detect_churn (6am UTC)            │
└──────────────────────────────────────┘
```

## Database schema

### Core tables

| Table | Purpose |
|-------|---------|
| `contacts` | Contact records with flexible JSONB fields |
| `field_definitions` | Admin-configurable field schema |
| `interactions` | Interaction/touchpoint log (append-only) |
| `tags` | Tag definitions |
| `contact_tags` | Contact ↔ tag join table |
| `segments` | Saved segment filters |
| `campaigns` | Email campaign records |
| `emails` | Log of every email sent |
| `scripts` | User-defined JS automation scripts |
| `script_runs` | Script execution history |
| `automation_rules` | Simple if/then automation rules |

### NextAuth tables

| Table | Purpose |
|-------|---------|
| `user` | App users (admins) |
| `account` | OAuth provider accounts |
| `session` | Session tokens |
| `verificationToken` | Magic link tokens |

### Flexible fields system

The app uses a **JSONB + field definitions** pattern — admins can add, remove, and reconfigure fields without schema changes or migrations.

```
field_definitions
├── id (uuid)
├── name (unique slug, e.g. "country", "lifecycle_stage")
├── label (display name, e.g. "Country")
├── field_type (text | number | date | email | url | select | multiselect | boolean | jsonb)
├── options (jsonb — allowed values for select/multiselect)
├── required (boolean)
├── sort_order (integer)
├── created_at, updated_at

contacts
├── id (uuid)
├── email (unique)
├── first_name, last_name
├── custom_fields (jsonb)  ← all field values keyed by field name
├── created_at, updated_at
```

Example `custom_fields` value:
```json
{
  "country": "DE",
  "lifecycle_stage": "active",
  "contact_types": ["member", "volunteer"],
  "skills": ["policy", "communications"],
  "hours_committed": 5
}
```

A GIN index on `custom_fields` enables fast querying across the JSONB structure.

## Segments and querying

Segments are stored as a `SegmentFilter` JSON structure:

```typescript
type SegmentFilter = {
  and?: FilterCondition[];
  or?: FilterCondition[];
}

type FilterCondition = {
  field: string;           // e.g. "country", "lifecycle_stage", "tag"
  op: "eq" | "neq" | "in" | "nin" | "contains" | "gte" | "lte" | ...
  value: string | string[] | number;
}
```

The `buildSegmentWhere()` function in `src/lib/segments.ts` translates these into Drizzle SQL WHERE clauses. Supports:
- Custom fields: `{ field: "country", op: "eq", value: "DE" }`
- Core columns: `{ field: "email", op: "contains", value: "@gmail" }`
- Tags: `{ field: "tag", op: "eq", value: "leader" }`
- AND/OR nesting: arbitrary depth

## Script engine

Users can write JavaScript automation scripts that run on schedule or on demand. Scripts run in a Node.js `vm` sandbox with a `ctx` API injected:

```javascript
// Example script
const dormant = await ctx.contacts.find({
  lifecycle_stage: { neq: "dormant" },
  last_interaction_days_ago: { gte: 90 }
});

for (const contact of dormant) {
  await ctx.contacts.update(contact.id, { lifecycle_stage: "dormant" });
  await ctx.interactions.create(contact.id, {
    type: "note",
    body: "Auto-flagged as dormant by script"
  });
}

ctx.log(`Flagged ${dormant.length} contacts as dormant`);
```

**`ctx` SDK methods:**
- `ctx.contacts.find(filter)` — find contacts matching a filter
- `ctx.contacts.update(id, fields)` — update contact fields
- `ctx.contacts.create(data)` — create a new contact
- `ctx.tags.add(contactId, tagName)` — add a tag to a contact
- `ctx.tags.remove(contactId, tagName)` — remove a tag
- `ctx.email.send({ to, subject, body })` — send an email via Mailersend
- `ctx.interactions.create(contactId, data)` — log an interaction
- `ctx.log(message)` — add to the run log

**Limits:** 30s timeout, max 1000 contacts per `find()`, max 100 emails per run.

## Authentication

Two auth paths:

**Browser sessions (Google OAuth)**
1. User signs in at `/login` via Google
2. Auth.js creates a JWT session token
3. Token stored in a cookie (`__Secure-authjs.session-token` in prod)
4. `auth()` from `src/lib/auth.ts` reads the session on the server
5. Admin status (`is_admin`) stored in the `user` table, loaded into JWT on sign-in

**API keys (machine-to-machine)**
1. Admin creates a key in Settings > API Keys
2. Key is shown once, then stored as a SHA-256 hash in the DB
3. Requests include `Authorization: Bearer pai_<key>`
4. `checkAuth()` in `src/lib/api-auth.ts` validates by hashing the provided key and comparing

**Admin auto-promotion:**
The `ADMIN_EMAILS` env var contains a comma-separated list of emails. Any user with a matching email is automatically promoted to admin on every sign-in (their JWT is refreshed each time the session is checked).

**DEV_BYPASS_AUTH:**
When `NODE_ENV=development` AND `DEV_BYPASS_AUTH=true`, all auth checks are skipped and the user is treated as an admin. This is completely safe — the `NODE_ENV` guard prevents it from activating in production.

## Access control

| Route type | Auth method |
|------------|-------------|
| `/dashboard/**` (pages) | Middleware cookie check → redirect to `/login` |
| `/api/**` (API routes) | `checkAuth()` → session or API key |
| Admin-only API routes | `requireAdmin()` → 403 if not admin |

## API design

- JSON request/response
- Auth via session cookie (browser) or `Authorization: Bearer pai_<key>` (API)
- Standard HTTP status codes
- List endpoints support pagination and filtering where relevant

### Key endpoints

```
# Contacts
GET    /api/contacts              list contacts (pagination, search, filter)
POST   /api/contacts              create contact
GET    /api/contacts/:id          get contact
PUT    /api/contacts/:id          update contact
DELETE /api/contacts/:id          delete contact
POST   /api/contacts/import       CSV import
GET    /api/contacts/:id/interactions  get interactions
POST   /api/contacts/:id/tags         add tags
DELETE /api/contacts/:id/tags         remove tags

# Segments
GET    /api/segments              list saved segments
POST   /api/segments              create segment
POST   /api/segments/preview      preview (count + sample contacts)

# Campaigns
GET    /api/campaigns             list campaigns
POST   /api/campaigns             create campaign
PUT    /api/campaigns/:id         update campaign
POST   /api/campaigns/:id/send    send now (enqueues job)
POST   /api/campaigns/:id/preview send preview email
GET    /api/campaigns/:id/emails  emails sent for campaign

# Scripts
GET    /api/scripts               list scripts
POST   /api/scripts               create script
PUT    /api/scripts/:id           update script
POST   /api/scripts/:id/run       run now (enqueues job)
GET    /api/scripts/:id/runs      run history

# Settings
GET    /api/fields                list field definitions
GET    /api/tags                  list tags
GET    /api/users                 list users (admin only)
GET    /api/api-keys              list API keys (admin only)

# Inbound webhooks
POST   /api/webhooks/tally        Tally form submission intake
POST   /api/webhooks/mailersend   Mailersend delivery/tracking events
```

## Worker jobs

| Task | Trigger | Description |
|------|---------|-------------|
| `send_campaign` | On-demand | Sends campaign to all contacts in its segment |
| `run_script` | Manual or cron | Runs a JS script in the VM sandbox |
| `detect_churn` | Cron: `0 6 * * *` | Flags contacts with no interaction in 90+ days |
| `dispatch_campaigns` | Cron: `* * * * *` | Enqueues campaigns whose `scheduledAt` has passed |
| `dispatch_scripts` | Cron: `* * * * *` | Enqueues scripts whose cron schedule matches current time |

## Hosting and deployment

**Railway** with three services:
- **web** — Next.js server (start: `npx drizzle-kit push && npm start`)
- **worker** — Node process (start: `npx tsx src/worker/index.ts`)
- **Postgres-JwGd** — managed PostgreSQL

The web service runs `drizzle-kit push` on every deploy to apply pending schema changes. Both services share the same `DATABASE_URL`.

See [deployment.md](deployment.md) for the full deploy guide.

## Design notes

- **Unified contact record:** A contact can be a member AND a journalist AND a donor. The `contact_types` custom field (multiselect) handles this. Deduplication by email.
- **Interaction log is append-only:** Never delete interaction history. This is the relationship memory.
- **Segment queries are dynamic:** Always evaluated at send time — they reflect current data, not a snapshot.
- **Tags vs fields:** Tags are lightweight labels (many-to-many, fast to add/remove). Fields are structured data with types and validation.
- **Worker dispatch pattern:** Static cron tasks (dispatch_campaigns, dispatch_scripts) run every minute and dynamically enqueue work. This means adding/editing scripts or campaigns doesn't require restarting the worker.

## What's not in v1

- Email template rich-text editor (using string interpolation for now)
- Mailersend open/click tracking (webhook endpoint exists, processing not wired)
- Dashboard analytics (Phase 9 — planned next)
- Discord integration
- AI-powered features (planned — see features.md)
- Drip/sequence campaigns
- Public volunteer portal
