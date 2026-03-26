# PauseAI Everything App — Build Plan

> Living document. Last updated: 2026-03-26.

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

### Phase 8c: External data sync (Connections) ✅

- [x] Schema: `connections`, `sync_configurations`, `sync_runs` tables
- [x] Connector abstraction (`Connector` interface with `testConnection`, `listResources`, `getSchema`, `fetchRecords`)
- [x] Airtable connector (PAT auth, cursor-based pagination, schema introspection)
- [x] Notion connector (integration token, database queries, property mapping)
- [x] Demo connector (fake data generator, dev only)
- [x] Connection management UI: create, test, delete connections
- [x] Sync configuration UI: resource picker, field mapping, schedule, duplicate strategy
- [x] Target-centric field mapping: external field sources + constant value sources
- [x] Sync engine (`src/lib/sync-engine.ts`): fetch, deduplicate by email, create/update contacts
- [x] Worker tasks: `run_sync` (on-demand) + `dispatch_syncs` (cron, every minute)
- [x] Sync runs with full statistics (fetched, created, updated, skipped, errored) and log
- [x] Schema validation: detect external field changes, set sync to `needs_repair`
- [x] Sync provenance on contacts: `sync_configuration_id` + `synced_fields` columns
- [x] UI: "Synced" badge in contacts table, read-only synced fields
- [x] UI: Attribution banner in contact detail (connection + sync links, last synced timestamp)
- [x] UI: Repair button for broken syncs on connection detail page
- [x] Batch contact deletion: checkbox selection + contextual action bar (up to 10k)
- [x] AG Grid Infinite Row Model for 10k–100k contacts (server-side pagination, search, sort)
- [x] Custom header checkbox for select-all on current page
- [x] CSV export via full server-side fetch (not limited to cached rows)

### Phase 9: Dashboard & reporting ✅

- [x] Dashboard page with overview stats cards
  - Total contacts / new this month / active / dormant
  - Contacts by lifecycle stage (donut chart)
  - Contacts by country (top 10 horizontal bar chart)
- [x] Intake trend chart (6-month bar chart of new contacts over time)
- [x] Recent activity feed (last 20 interactions with contact links)
- [x] Campaign performance metrics (sent, delivered, opened, clicked, bounced counts + open rate)
- [x] CSV export from contacts table and any segment view
- [x] Mailersend webhook tracking (delivery/open/click/bounce/unsubscribe events → `emails` table status updates + campaign aggregate recalculation)

### Phase 10: Workspaces (Multi-Tenancy) ✅

- [x] Schema: `workspaces` table (id, name, slug, type: global/chapter, defaultLanguage)
- [x] Schema: `user_workspaces` junction table (userId, workspaceId, role)
- [x] Schema: `contact_workspaces` junction table (contactId, workspaceId, subscriptionStatus)
- [x] Schema: workspace_id columns on tags, segments, campaigns, communication_categories, connections, sync_configurations
- [x] Schema: field_definitions scope system (core, global_internal, workspace)
- [x] Workspace context resolution: cookie (`pauseai_workspace`), header (`X-Workspace-Id`), query param
- [x] Server-side workspace helpers: `getServerWorkspaceId()`, `isServerWorkspaceGlobal()` (via cookies)
- [x] API workspace context: `getActiveWorkspaceId(request)`, `requireWorkspaceAdmin()`
- [x] Client-side workspace provider: `WorkspaceProvider`, `useWorkspace()`, `useWorkspaceId()`, `useWorkspaceFetch()`
- [x] Two-layer role system: global role + workspace role, effective = max(both)
- [x] Client-side effective role: `useEffectiveRole()`, `useHasRole()` hooks
- [x] Server-side effective role: `getEffectiveRole()` in workspaces.ts
- [x] Workspace switcher in sidebar (hidden if user has only one workspace)
- [x] Workspace-scoped contacts: API filters by `contact_workspaces` junction
- [x] Workspace-scoped tags: tags have workspace_id, API filters by workspace
- [x] Workspace-scoped segments: segments belong to workspace, preview/query scoped
- [x] Workspace-scoped campaigns: campaigns belong to workspace, recipient resolution workspace-aware
- [x] Workspace-scoped communication categories: categories have workspace_id, API filters by workspace
- [x] Workspace-scoped custom fields: scope system (core=all, global_internal=global only, workspace=specific)
- [x] Workspace-scoped user management: users page shows only workspace members, role changes per-workspace
- [x] Add-contact flow: detects existing contacts (409) and offers "Add to Workspace" button
- [x] Workspace management UI: Settings > Workspaces page (global admin only) — create, edit, delete chapter workspaces
- [x] Dev login: Credentials provider with preset users, workspace selector dropdown, auto-creates workspace memberships
- [x] Settings layout: uses effective role (not just global role) to grant workspace admin access
- [x] Communication preference keys namespaced by workspace: `workspaceId:categoryName`
- [x] Segment tag filter: workspace-scoped tag matching with NULL fallback for legacy data
- [x] Segment builder: field change handler correctly resets operator per field type (e.g., "has" for tags)
- [x] Unsubscribe flow: workspace-aware preference center with per-workspace sections
- [x] Workspace-scoped automations: scripts and rules CRUD, execution, and UI all filtered by workspace
- [x] Script engine workspace isolation: ctx.contacts.find and tag operations scoped to script's workspace
- [x] Subscription table display: cell renderer uses workspace-namespaced preference keys (workspaceId:categoryName)
- [x] Contacts table auto-refresh after contact creation (custom event → AG Grid cache purge)
- [x] Campaign segment update fix: `segmentId` preserved through `stripNulls` (same pattern as `categoryId`)
- [x] Connection detail pages redirect to connections list on workspace mismatch
- [x] Connections promoted to top-level sidebar item (admin-only, with PlugIcon) — moved from Settings sub-menu

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
- **After Phase 8b:** Contacts can manage their email subscriptions. Compliant unsubscribe system.
- **After Phase 8c:** External data flows in automatically. Airtable and Notion contacts sync on schedule with provenance tracking. Table scales to 100k contacts.
- **After Phase 9:** You have visibility into how the org is doing. Full v1.
- **After Phase 10:** Multi-tenant with workspaces. Each chapter operates independently. ← *we are here*
