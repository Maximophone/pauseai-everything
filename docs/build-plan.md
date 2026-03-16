# PauseAI Everything App — Build Plan

> Living document. Last updated: 2026-03-15.

## Tech decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | Best AI coding support, huge ecosystem |
| Language | TypeScript | Type safety, AI-friendly |
| ORM | Drizzle | Close to SQL, good JSONB support (Prisma's is limited) |
| Database | PostgreSQL | Relational + JSONB, scales easily |
| Job queue | graphile-worker | Postgres-backed, mature, good cron support |
| UI components | shadcn/ui | Composable, unstyled primitives, works with Tailwind |
| Table | AG Grid Community | Inline editing, filtering, bulk paste, free |
| Auth | NextAuth.js / Auth.js | Simple, supports Google OAuth + magic links |
| Email | Mailersend API | Already in use |
| Hosting | Railway | Web + worker + Postgres, git-push deploys |

## Build phases

### Phase 1: Scaffold & data layer

- [x] Create GitHub repo
- [x] Initialize Next.js project with TypeScript + Tailwind CSS
- [x] Set up Drizzle ORM + Postgres schema
- [x] Set up Vitest testing infrastructure
- [x] Define schema: `contacts`, `field_definitions`, `interactions`, `users`, `tags`, `emails`
- [ ] Set up shadcn/ui components
- [ ] Set up Postgres for local dev (Docker)
- [ ] Run initial Drizzle migration
- [ ] Seed default field definitions (lifecycle_stage, country, contact_types, skills, etc.)
- [ ] Basic app layout (sidebar nav, header, content area)
- [ ] NextAuth.js with Google OAuth

### Phase 2: Contacts CRUD

- [ ] API: `GET/POST/PUT/DELETE /api/contacts`
- [ ] API: `GET/POST/PUT/DELETE /api/fields`
- [ ] Contacts table view with AG Grid (columns from field_definitions)
- [ ] Inline cell editing in table
- [ ] Contact detail page with dynamic form
- [ ] Search (name, email)
- [ ] Filtering by any field

### Phase 3: Interactions & tags

- [ ] Schema: `interactions`, `tags`, `contact_tags`
- [ ] API: interactions CRUD
- [ ] API: tags CRUD + assign/remove from contacts
- [ ] Interaction timeline on contact detail page
- [ ] "Log interaction" form (type, notes, date)
- [ ] Tag management UI
- [ ] Bulk tag actions in table view

### Phase 4: Intake & import

- [ ] Tally webhook endpoint (`POST /api/webhooks/tally`)
- [ ] Contact creation + routing logic (country → chapter)
- [ ] CSV import: upload, column mapping, preview, import
- [ ] Quick-add modal (minimal form: name + email)

### Phase 5: User management & permissions

- [ ] Schema: roles on users table
- [ ] Invite user flow (admin sends invite email)
- [ ] Role-based access control middleware
- [ ] User management admin page
- [ ] API key generation for machine-to-machine access

### Phase 6: Field management UI

- [ ] Admin page: list all field definitions
- [ ] Create/edit/delete fields
- [ ] Reorder fields (drag & drop or sort order)
- [ ] Manage select/multi_select options
- [ ] Set applies_to (contact type scoping)

### Phase 7: Segmentation & email

- [ ] Schema: `segments`, `campaigns`, `campaign_recipients`, `email_templates`
- [ ] Segment query builder UI
- [ ] Segment preview (count + sample contacts)
- [ ] Save/load segments
- [ ] Mailersend integration: send single email, send batch
- [ ] Broadcast email: select segment → compose → preview → send
- [ ] Mailersend webhook endpoint (delivery tracking)
- [ ] Email history on contact timeline

### Phase 8: Background jobs & automations

- [ ] Set up graphile-worker
- [ ] Worker process configuration (separate from web)
- [ ] Job: send campaign batch (chunk contacts, send via Mailersend)
- [ ] Job: process Tally submission
- [ ] Cron: daily drip campaign advancement
- [ ] Cron: churn detection (flag dormant contacts)
- [ ] Automation rules engine (if/then rules, admin-configurable)

### Phase 9: Dashboard & reporting

- [ ] Dashboard page with overview cards
- [ ] Contacts by stage (funnel view)
- [ ] Intake trend chart
- [ ] Recent activity feed
- [ ] Campaign performance stats
- [ ] CSV export from any view

## Testing strategy

Every phase ships with tests. The core data layer and API must be robust.

**Unit tests (Vitest):**
- Data validation logic (field type validation, required fields, JSONB schema enforcement)
- Segment query builder → SQL translation
- Business logic (lifecycle transitions, deduplication, routing)

**Integration tests (Vitest + real Postgres):**
- API endpoints: CRUD operations, error cases, auth checks
- Webhook handlers: Tally intake, Mailersend events
- Background jobs: campaign sending, churn detection

**Test infrastructure:**
- Test database spun up via Docker (separate from dev DB)
- Database reset between test suites
- Factory functions for creating test contacts, interactions, etc.
- API test helpers for authenticated requests

**Rule:** No API endpoint or background job ships without tests covering happy path + key error cases.

## What "done" looks like per phase

- **After Phase 2:** You can browse, search, edit contacts in a table. Replaces Airtable for viewing data.
- **After Phase 4:** New joiners flow in automatically. You can import your Airtable data. The system is live.
- **After Phase 5:** Team can log in with their own accounts. Permissions enforced.
- **After Phase 7:** You can send targeted emails to segments. Full Airtable+Mailersend replacement.
- **After Phase 9:** You have visibility into how the org is doing. Full v1.
