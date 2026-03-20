# PauseAI Everything App — Build Plan

> Living document. Last updated: 2026-03-20.

## Tech decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | Best AI coding support, huge ecosystem |
| Language | TypeScript | Type safety, AI-friendly |
| ORM | Drizzle | Close to SQL, good JSONB support (Prisma's is limited) |
| Database | PostgreSQL | Relational + JSONB, scales easily |
| Job queue | graphile-worker | Postgres-backed, mature, good cron support |
| UI components | shadcn/ui + @base-ui/react | Composable, unstyled primitives, works with Tailwind |
| Table | AG Grid Community | Inline editing, filtering, bulk paste, free |
| Auth | NextAuth.js / Auth.js v5 | Simple, supports Google OAuth |
| Email | Mailersend API | Already in use |
| Hosting | Railway | Web + worker + Postgres, git-push deploys |

## Build phases

### Phase 1: Scaffold & data layer ✅

- [x] Create GitHub repo
- [x] Initialize Next.js project with TypeScript + Tailwind CSS
- [x] Set up Drizzle ORM + Postgres schema
- [x] Set up Vitest testing infrastructure
- [x] Define schema: `contacts`, `field_definitions`, `interactions`, `users`, `tags`, `emails`, `segments`, `campaigns`, `scripts`, `script_runs`, `automation_rules`
- [x] Set up shadcn/ui + @base-ui/react components
- [x] Docker Compose for local Postgres
- [x] Drizzle push (schema sync, no migration files needed for dev)
- [x] Basic app layout (sidebar nav, header, content area)
- [x] NextAuth.js with Google OAuth

### Phase 2: Contacts CRUD ✅

- [x] API: `GET/POST/PUT/DELETE /api/contacts`
- [x] API: `GET/POST/PUT/DELETE /api/fields`
- [x] Contacts table view with AG Grid (columns from field_definitions)
- [x] Inline cell editing in table
- [x] Contact detail page with dynamic form
- [x] Search (name, email, any field)
- [x] Filtering by any field

### Phase 3: Interactions & tags ✅

- [x] Schema: `interactions`, `tags`, `contact_tags`
- [x] API: interactions CRUD
- [x] API: tags CRUD + assign/remove from contacts
- [x] Interaction timeline on contact detail page
- [x] "Log interaction" form (type, notes, date)
- [x] Tag management UI
- [x] Bulk tag actions in table view
- [x] Tags column in contacts table

### Phase 4: Intake & import ✅

- [x] Tally webhook endpoint (`POST /api/webhooks/tally`)
- [x] CSV import: upload, column mapping, preview, import
- [x] Quick-add modal (minimal form: name + email)

### Phase 5: User management & permissions ✅

- [x] `is_admin` boolean on users table
- [x] Admin invite flow
- [x] Role-based access control (admin vs non-admin) on all API endpoints
- [x] User management admin page (Settings > Users)
- [x] API key generation for machine-to-machine access (Settings > API Keys)
- [x] `ADMIN_EMAILS` env var auto-promotes emails to admin on first sign-in

### Phase 6: Field management UI ✅

- [x] Admin page: list all field definitions (Settings > Fields)
- [x] Create/edit/delete fields
- [x] Reorder fields (sort order)
- [x] Manage select/multi_select options
- [x] Field types: text, number, date, email, url, select, multiselect, boolean

### Phase 7: Segmentation & email ✅

- [x] Schema: `segments`, `campaigns`, `emails`
- [x] Segment query builder UI (AND/OR, all field types, tags)
- [x] Segment preview (count + sample contacts)
- [x] Save/load segments
- [x] Mailersend integration: send single email, send batch
- [x] Broadcast email: select segment → compose → send now or schedule
- [x] Campaign scheduling (save `scheduledAt`, worker dispatches at the right time)
- [x] Preview email (send test to any address)
- [x] Campaign detail view with sent email list
- [x] Inline campaign editing
- [x] Email history on contact timeline (via `emails` table)

### Phase 8: Background jobs & automations ✅

- [x] graphile-worker set up (Postgres-backed job queue)
- [x] Separate worker process (`src/worker/index.ts`)
- [x] Job: `send_campaign` — sends campaign to segment contacts via Mailersend
- [x] Job: `dispatch_campaigns` (cron: every minute) — enqueues scheduled campaigns
- [x] Job: `detect_churn` (cron: daily 6am UTC) — flags dormant contacts
- [x] Job: `run_script` — executes user-defined JS in a VM sandbox
- [x] Job: `dispatch_scripts` (cron: every minute) — enqueues scripts on their cron schedule
- [x] Script engine with `ctx` SDK (contacts.find/update, tags, email.send, interactions.create)
- [x] Script editor UI with CodeMirror, cron presets, run history, templates
- [x] Automation rules engine (if/then rules, runs on schedule)
- [x] Deployed to Railway (web + worker + Postgres)

### Phase 8b: Communication preferences & unsubscribe ✅

- [x] Schema: `communication_categories` table, `app_settings` table
- [x] Schema: `contacts.communication_preferences` JSONB column
- [x] Schema: `campaigns.category_id` FK to communication_categories
- [x] Seed default categories (newsletter, events, action-alerts)
- [x] HMAC-SHA256 stateless unsubscribe tokens (`src/lib/unsubscribe-tokens.ts`)
- [x] Communication categories CRUD (lib + API + Zod schemas)
- [x] Campaign send flow: filter opted-out contacts, generate unsubscribe URLs
- [x] `{{unsubscribe}}` merge variable in campaign email bodies
- [x] Campaign UI: category dropdown in create/edit forms
- [x] Campaign recipients preview: show "Unsubscribed" badge for opted-out contacts
- [x] Public unsubscribe page (`/unsubscribe`) with preference center
- [x] Public unsubscribe API (`POST /api/unsubscribe`, `GET /api/unsubscribe/preferences`)
- [x] Mailersend webhook: handle `activity.unsubscribed` → update contact preferences
- [x] Per-contact subscription status in contact detail page
- [x] Subscription status column in contacts table
- [x] Admin UI for managing email categories (Settings > Email Categories)
- [x] App settings system with UI toggle for RFC 8058 List-Unsubscribe header
- [x] Unsubscribe token tests

### Phase 9: Dashboard & reporting 🔲

- [ ] Dashboard page with overview stats cards
  - Total contacts / new this month / active / dormant
  - Contacts by lifecycle stage (funnel view)
  - Contacts by country (top N)
- [ ] Intake trend chart (new contacts over time)
- [ ] Recent activity feed (latest interactions, campaign sends)
- [ ] Campaign performance metrics (open rate, click rate, bounces)
- [ ] CSV export from contacts table and any segment view
- [ ] Mailersend webhook tracking (delivery/open/click events → `emails` table status updates)

---

## Testing strategy

Every phase ships with tests. The core data layer and API must be robust.

**Unit tests (Vitest):**
- Data validation logic
- Segment query builder → SQL translation ✅
- Script engine sandbox ✅
- Business logic (lifecycle transitions, deduplication)

**Integration tests (Vitest + real Postgres):** ⚠️ Not yet implemented
- API endpoints: CRUD operations, error cases, auth checks
- Webhook handlers: Tally intake, Mailersend events
- Background jobs: campaign sending, churn detection

**Test infrastructure needed:**
- Test database with reset between suites
- Factory functions for test data
- API test helpers for authenticated requests

**Rule:** No API endpoint or background job ships without tests covering happy path + key error cases.

---

## What "done" looks like per phase

- **After Phase 2:** You can browse, search, edit contacts in a table. Replaces Airtable for viewing data.
- **After Phase 4:** New joiners flow in automatically. You can import your Airtable data. The system is live.
- **After Phase 5:** Team can log in with their own accounts. Permissions enforced.
- **After Phase 7:** You can send targeted emails to segments. Full Airtable+Mailersend replacement.
- **After Phase 8b:** Contacts can manage their email subscriptions. Compliant unsubscribe system. ← *we are here*
- **After Phase 9:** You have visibility into how the org is doing. Full v1.
