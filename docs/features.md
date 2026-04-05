# PauseAI Everything App — Features

> Living document. Last updated: 2026-04-05.

## Milestone 1: Core CRM (launch target)

### 1.1 Contact management

**Table view (primary interface)**
- Spreadsheet-like table powered by AG Grid (open source Community Edition)
- Inline cell editing — click a cell, type, save
- Columns generated dynamically from field definitions
- Sort, filter, group by any field
- Column show/hide, reorder, resize
- Multi-row selection for bulk actions (tag, change stage, delete)
- CSV export of current view
- Pagination or virtual scrolling for large datasets

**Contact detail view**
- Full profile page for a single contact
- All fields displayed as an editable form
- Interaction timeline (see 1.3)
- Email history (see 1.4)
- Tags management
- Lifecycle stage with visual indicator + history
- Links to external systems (Notion pages, Discord profile, etc.)

**Search**
- Global search bar — search by name, email, or any text field
- Full-text search powered by Postgres `tsvector` or `ILIKE` on key fields

### 1.2 Data entry — multiple entrypoints

The system must support multiple ways for data to enter:

| Entrypoint | How it works | Priority |
|---|---|---|
| **Table inline editing** | Direct cell editing in the AG Grid table. Admins can add rows, edit cells, paste data. | v1 |
| **Contact detail form** | Structured form on the contact profile page. Good for careful data entry. | v1 |
| **Tally webhook** | Form submission → webhook → API → new contact created and routed. Existing flow, needs to work day one. | v1 |
| **REST API** | Full CRUD API for contacts, interactions, tags. Used by n8n, scripts, other systems. | v1 |
| **CSV import** | Upload a CSV, map columns to fields, preview, import. Essential for Airtable migration. | v1 |
| **Manual "quick add"** | Minimal modal/form — just name + email + key fields — for logging someone you just met. | v1 |
| **Bulk paste** | Paste tabular data (from a spreadsheet) into the table view. AG Grid supports this natively. | v1 (free with AG Grid) |
| **Email forwarding/parsing** | Forward an email to the system, it extracts contact info and logs the interaction. | Future (AI feature) |
| **Discord bot** | Bot watches Discord, logs activity as interactions. | Future |

### 1.3 Interaction logging

Every meaningful touchpoint with a contact is logged as an interaction.

**Interaction types:**
- Email sent / received
- Phone call
- Video call / meeting
- Discord message (manual log for now)
- Note (free-form, e.g. "ran into them at conference")
- Event attended
- Form submitted
- Action taken (signed petition, attended protest)
- Stage change (auto-logged)

**How interactions are created:**
- **Manual:** User clicks "Log interaction" on a contact profile, fills in type + notes + date
- **Automatic (email):** When the system sends an email, it's logged automatically. Mailersend webhooks update status (delivered, opened, clicked).
- **Automatic (intake):** Tally form submission creates an interaction.
- **Automatic (lifecycle):** Stage changes are logged as interactions.
- **Via API:** External systems can POST interactions.

**Display:**
- Contact profile shows a reverse-chronological timeline of all interactions
- Each entry shows: type icon, date, subject/summary, logged by whom, expandable details
- Filterable by type

### 1.4 Email history

Emails sent through the system are stored and tracked:

- Full email content (subject + body) saved per recipient
- Delivery status from Mailersend webhooks: sent → delivered → opened → clicked / bounced / complained
- Visible on the contact's timeline alongside other interactions
- Campaign emails link back to the campaign they were part of

### 1.5 Lifecycle stage tracking

- Each contact has a lifecycle stage (configurable — defined as a `select` field)
- Default stages: Joined → Onboarding → Active → Highly Active → Dormant → Churned
- Admins can customize stages
- Stage changes are logged with timestamp, who/what triggered it, and reason
- Visual pipeline/funnel view showing counts per stage (dashboard widget)
- Manual stage changes via dropdown on contact profile or bulk action in table
- Automated stage changes via rules (see Milestone 2 — automations)

### 1.6 Tags

- Lightweight labels attached to contacts (many-to-many)
- Create tags on the fly or from a managed list
- Tag from contact profile, table bulk action, or API
- Tags are distinct from fields — no type, no validation, just labels
- Used in segment filters

### 1.7 User auth & management

**Authentication:**
- Google OAuth (primary — everyone on the team has Google)
- Magic link email as fallback
- Powered by NextAuth.js / Auth.js

**Roles (3-tier):**
- **Admin:** Full access. Manage contacts, send campaigns, configure fields/settings, manage users, create segments/scripts.
- **Member:** Can view and edit contacts, tags, and interactions. Cannot send campaigns, create segments/scripts, manage fields, or access settings.
- **Viewer:** Read-only access across the board. Cannot create, edit, or delete anything.

**User management (admin only):**
- Invite users by email
- Assign/change roles
- Deactivate users
- View list of all users

### 1.8 REST API

Full API for programmatic access. Every feature available in the UI should be available via API.

**Endpoints (draft):**

```
# Contacts
GET    /api/contacts              — list/search/filter contacts
POST   /api/contacts              — create contact
GET    /api/contacts/:id          — get contact detail
PUT    /api/contacts/:id          — update contact
DELETE /api/contacts/:id          — delete contact
POST   /api/contacts/import       — CSV import

# Interactions
GET    /api/contacts/:id/interactions  — list interactions for a contact
POST   /api/interactions               — log an interaction

# Tags
GET    /api/tags                  — list all tags
POST   /api/contacts/:id/tags     — add tags to contact
DELETE /api/contacts/:id/tags/:id — remove tag from contact

# Fields
GET    /api/fields                — list field definitions
POST   /api/fields                — create field definition (admin)
PUT    /api/fields/:id            — update field definition (admin)
DELETE /api/fields/:id            — delete field definition (admin)

# Segments
GET    /api/segments              — list saved segments
POST   /api/segments              — create segment
POST   /api/segments/preview      — preview segment (returns matching contact count + sample)

# Campaigns
GET    /api/campaigns             — list campaigns
POST   /api/campaigns             — create campaign
POST   /api/campaigns/:id/send    — send/schedule campaign

# Webhooks (inbound)
POST   /api/webhooks/tally        — Tally form submission
POST   /api/webhooks/mailersend   — Mailersend delivery/tracking events

# Users
GET    /api/users                 — list users (admin)
POST   /api/users/invite          — invite user (admin)
PUT    /api/users/:id             — update user role (admin)

# Auth
GET    /api/auth/...              — NextAuth.js routes
```

**API design principles:**
- JSON request/response
- API key auth for machine-to-machine (n8n, scripts). Session auth for browser.
- Consistent pagination, filtering, sorting on list endpoints
- Rate limiting
- All mutations are auditable (who did what, when)

### 1.9 Field management (admin)

- UI to view, create, edit, reorder, and delete field definitions
- Field types: text, number, date, email, url, select, multi_select, boolean
- For select/multi_select: manage allowed options
- Set which contact types a field applies to
- Set required/optional
- Set whether field appears in the table list view
- Deleting a field: soft delete (data preserved in JSONB, just hidden)

---

## Milestone 2: Communications & Automation

### 2.1 Segmentation UI
- Visual query builder — pick field, pick operator, pick value, add conditions
- AND/OR grouping
- Save segments with a name
- Preview: show count + sample contacts before using
- Segments available as campaign targets

### 2.1b Communication preferences & unsubscribe ✅

**Email categories (admin-managed):**
- Admin UI at Settings > Email Categories to create/edit/delete categories
- Default categories seeded: newsletter, events, action-alerts
- Each category has a slug name, display label, and description

**Per-contact preferences:**
- Each contact has a `communicationPreferences` JSONB field: `{ "newsletter": true, "events": false }`
- Missing key = opted-in. Explicit `false` = opted-out
- Visible on contact detail page as toggle switches
- Subscription status column in contacts table (shows "All subscribed" or lists opted-out categories)

**Campaign category assignment:**
- Campaigns can be assigned a category (or left as "transactional" with no category)
- Categorized campaigns filter out opted-out contacts at send time
- Campaign recipient preview shows "Unsubscribed" badge for opted-out contacts with active/unsubscribed count breakdown

**Unsubscribe system:**
- Stateless HMAC-SHA256 tokens: `HMAC(contactId:categoryName, UNSUBSCRIBE_SECRET)` — tokens never expire
- `{{unsubscribe}}` merge variable available in campaign email body, resolves to a signed unsubscribe URL
- Public `/unsubscribe` page: validates token, auto-unsubscribes on load (one-click), shows preference center for all categories
- API endpoints: `POST /api/unsubscribe` (token-authenticated), `GET /api/unsubscribe/preferences`
- Mailersend `activity.unsubscribed` webhook automatically updates contact preferences

**RFC 8058 List-Unsubscribe header:**
- Optional: controlled by a UI toggle in Settings > Email Categories
- Requires Mailersend Professional+ plan — disabled by default to avoid API errors on lower plans
- When enabled, Mailersend adds native `List-Unsubscribe` and `List-Unsubscribe-Post` headers

**App settings:**
- `app_settings` table: simple key-value store for app-level configuration
- API: `GET/PUT /api/settings` (admin-only for writes)
- Currently used for the RFC 8058 toggle; designed to support future settings

### 2.2 Broadcast email
- Select a segment or saved filter as audience
- Compose email (subject + rich text body) or pick a template
- Merge fields (e.g. {{firstName}}, {{email}}, any custom field) — values are HTML-escaped automatically
- Preview with sample contact
- Schedule for later or send now
- Sends via Mailersend API
- Track delivery stats (sent, delivered, opened, clicked, bounced)
- Automatic deduplication (a contact in multiple overlapping segments receives it once)

### 2.3 Email sequences / drip campaigns
- Define a sequence: trigger → step 1 (delay + email) → step 2 → ...
- Triggers: on join, on tag added, on stage change, manual enrollment
- Conditions per step (e.g., only send step 3 if they opened step 2)
- Contact can be in multiple sequences
- Exit conditions (e.g., exit sequence if stage changes to "active")
- Worker process advances sequences daily

### 2.4 Email templates
- Reusable templates with merge fields
- Simple rich text editor (or markdown)
- Preview with sample data
- Used by broadcasts and sequences

### 2.5 Automation rules
- Simple if/then rules that run on schedule or on trigger
- Examples:
  - "If no interaction in 60 days → set stage to Dormant"
  - "If joined and country = NL → add tag 'netherlands', assign to chapter-nl"
  - "If lifecycle_stage changed to Active → send welcome-active email"
- Admin UI to create/edit rules
- Execution log showing what each rule did

---

## Milestone 3: Reporting & Insights

### 3.1 Dashboard
- Overview cards: total contacts, new this month, by stage, by country
- Intake trend chart (new contacts over time)
- Churn/dormancy rate
- Top chapters by active members
- Recent activity feed (latest interactions logged by all users)

### 3.2 Reporting
- Contacts by segment over time
- Campaign performance (open rate, click rate, by segment)
- Interaction volume by type, by user
- Exportable as CSV

---

## Milestone 1c: Workspaces (Multi-Tenancy) ✅

Multi-tenant architecture so PauseAI Global and national chapters can operate independently. See [specs/workspaces.md](specs/workspaces.md) for the full design spec.

**Workspace model:**
- Two workspace types: `global` (exactly one — PauseAI Global) and `chapter` (one per national chapter)
- Flat hierarchy — no nesting, chapters use tags for internal subdivisions
- Each workspace has a name, slug, type, and default language
- Workspace management UI for global admins (create, edit, delete chapter workspaces)

**Workspace-scoped data:**
- Contacts linked via `contact_workspaces` junction table — a workspace only sees its own contacts
- Tags, segments, campaigns, communication categories all belong to a workspace
- Custom fields have three scopes: `core` (all workspaces), `global_internal` (global only), `workspace` (specific workspace)
- User memberships per workspace via `user_workspaces` junction table

**Two-layer role system:**
- Global role (on `users` table) + workspace role (on `user_workspaces`)
- Effective role = max(global role, workspace role)
- Workspace admins manage their own workspace; global admins manage everything
- Settings, user management, and navigation all respect effective role

**Workspace context:**
- Cookie (`pauseai_workspace`), header (`X-Workspace-Id`), or query param
- `WorkspaceProvider` on client — provides `useWorkspace()`, `useWorkspaceFetch()` (auto-injects header)
- Server-side: `getServerWorkspaceId()` (cookies), `getActiveWorkspaceId(request)` (API)
- Workspace switcher in sidebar for multi-workspace users

**Communication preferences:**
- Categories are workspace-scoped — same name in different workspaces means different categories
- Preference keys namespaced: `workspaceId:categoryName`
- Unsubscribe page shows per-workspace sections

**Add-contact flow:**
- If contact already exists (by email), offers "Add to Workspace" instead of creating a duplicate
- New contacts automatically linked to the active workspace

**Dev login (development only):**
- Preset users with different roles and workspace memberships
- Custom email form with workspace selector dropdown
- Auto-creates workspace memberships on first login

---

## Sandbox Mode (Email Testing) ✅

Safe email testing infrastructure that intercepts all outbound email at the application level.

### Email interception

- **Environment-based switching:** `EMAIL_MODE=sandbox` (default) captures all email in the database; `EMAIL_MODE=live` sends via Mailersend
- **Single interception point:** All email paths (campaigns, previews, scripts, invitations, notifications) go through `sendEmail()` in `src/lib/mailersend.ts`
- **Full capture:** Sandbox stores the rendered HTML body, all headers (including List-Unsubscribe), recipient, sender, campaign/workspace context
- **Transparent to the rest of the system:** The `emails` table is still written to, campaign stats still update, everything behaves identically except no HTTP request leaves the server

### Event simulation

- **Simulate delivery events** on sandbox emails: delivered, opened, clicked, bounced, unsubscribed
- **Uses real webhook logic:** Simulation calls the same `processEmailEvent()` function as the Mailersend webhook handler
- **Full lifecycle testing:** Simulating "unsubscribed" updates contact communication preferences; simulating "delivered" updates campaign delivery counts; etc.

### Sandbox API (admin-only, returns 404 in live mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sandbox/status` | GET | Check current mode |
| `/api/sandbox/emails` | GET | List captured emails (filters: campaignId, to, workspaceId, status, since) |
| `/api/sandbox/emails/:id` | GET | Full email detail (rendered body, headers) |
| `/api/sandbox/emails/:id/simulate` | POST | Simulate delivery event |
| `/api/sandbox/emails/simulate-bulk` | POST | Bulk event simulation |
| `/api/sandbox/emails` | DELETE | Clear sandbox data |

### Sandbox UI

- **Amber banner** across the top of the dashboard when in sandbox mode (not dismissable)
- **Sandbox viewer** at `/dashboard/sandbox` (admin-only, sidebar entry with flask icon):
  - Table of all captured emails with recipient, subject, status, timestamp
  - Click to expand: full rendered HTML in iframe, headers, status history
  - Event simulation buttons per email and in bulk
  - Filters by recipient and campaign
  - Clear all button

### AI-driven end-to-end testing

The sandbox API enables fully automated test flows:
1. `DELETE /api/sandbox/emails` — clean slate
2. Create contacts, segments, campaigns via API
3. `POST /api/campaigns/:id/send` — trigger send
4. `GET /api/sandbox/emails?campaignId=:id` — verify emails captured
5. `POST /api/sandbox/emails/:id/simulate { "event": "delivered" }` — simulate delivery
6. `GET /api/campaigns/:id/emails` — verify stats updated
7. `POST /api/sandbox/emails/:id/simulate { "event": "unsubscribed" }` — simulate unsubscribe
8. Verify contact preferences updated, re-send excludes unsubscribed contact, etc.

---

## Milestone 4: Extended features (future)

- **AI natural language querying** — "show me all French volunteers who joined this year"
- **AI interaction summarization** — paste an email thread, AI extracts key details and logs it
- **Discord integration** — bot tracks activity, logs as interactions
- **Public volunteer dashboard** — volunteers log in, see their profile, upcoming actions
- **Event management** — create events, track RSVPs, record attendance
- ~~**Chapter management** — chapters as first-class entities with dashboards~~ → Replaced by Workspaces (Milestone 1c)
- **Donor management** — donation tracking, receipts, reports
- **Notion integration** — bidirectional links, maybe surface CRM data in Notion

---

## Milestone 1b: External Data Sync (Connections)

### 1b.1 Connection management

**Connections** are authenticated links to external data sources. Each connection stores credentials and can host multiple sync configurations.

**Supported connectors:**
| Connector | Status | Credentials |
|-----------|--------|-------------|
| **Airtable** | Available | Personal Access Token (PAT) with `data.records:read` + `schema.bases:read` scopes |
| **Notion** | Available | Integration token |
| **Google Sheets** | Planned | — |
| **Mailchimp** | Planned | — |
| **Demo** | Dev only | None (generates fake data) |

**Connection lifecycle:**
- Create connection → test credentials → status: `connected` / `error` / `untested`
- Each connection shows its syncs, status, and last test result
- Connector interface: `testConnection()`, `listResources()`, `getSchema()`, `fetchRecords()` (cursor-based pagination)

### 1b.2 Sync configurations

A sync defines how data flows from one external resource (e.g. an Airtable table, a Notion database) into the CRM.

**Configuration:**
- **External resource:** which table/database to pull from (discovered via `listResources()`)
- **Field mapping (target-centric):** for each CRM field, define how to populate it:
  - `field` source — maps an external column to the CRM field (with optional transform: `to_string`, `to_number`, `to_date`, `to_boolean`)
  - `constant` source — hardcode a value for all synced contacts (e.g., always tag as "airtable-import")
- **Duplicate strategy:** `update` (overwrite matched contacts) or `skip` (ignore existing)
- **Frequency:** `manual`, `hourly`, `daily`, `weekly`
- **Status:** `active` | `paused` | `needs_repair` | `error`

**Schema validation:**
- External schema is cached on the sync configuration at save time
- Before each sync run, the engine validates that mapped external fields still exist
- If the external schema changed (fields renamed/deleted), the sync goes into `needs_repair` status with a descriptive error message

**Supported CRM targets:**
- Built-in fields: `_email`, `_firstName`, `_lastName`, `_tags`
- Any custom field definition name (e.g., `country`, `lifecycle_stage`)
- `_tags` is a special target: values are added via the tag system, not written to `customFields`

### 1b.3 Sync execution

**Sync engine** (`src/lib/sync-engine.ts`):
- Fetches all records from the external source via cursor-based pagination
- For each record, resolves the field mapping (external field lookups + constant values)
- Deduplicates by email: if a contact with the same email exists, update; otherwise create
- Tags (via `_tags` target) are added cumulatively — never removed by sync
- Sets sync provenance on each contact: `syncConfigurationId` + `syncedFields` (list of CRM target names written by this sync)

**Worker tasks:**
- `run_sync` — executes a single sync run (triggered manually or by scheduler)
- `dispatch_syncs` — cron job (every minute) that enqueues due syncs based on their frequency

**Sync runs** are logged with full statistics: records fetched, created, updated, skipped, errored, plus a text log and any error message.

### 1b.4 Sync provenance & read-only fields

Contacts imported via sync carry provenance metadata:
- `sync_configuration_id` (UUID, FK → `sync_configurations`, SET NULL on delete)
- `synced_fields` (JSONB string array of CRM target names, e.g., `["_email", "_firstName", "country"]`)

**UI indicators:**
- **Contacts table:** "Synced" badge next to synced contact names; synced fields are non-editable (greyed out cells)
- **Contact detail page:** Attribution banner showing connection name + link, sync name + link, and "Last synced" timestamp; synced field labels show a lock badge; synced field inputs are disabled
- **Repair button:** Syncs in `needs_repair` status show a Repair button on the connection detail page that links to the sync configuration for re-mapping

### 1b.5 Contacts table at scale

The contacts table uses **AG Grid Infinite Row Model** to handle 10k–100k contacts:
- Server-side pagination: 200 rows per block, up to 50 blocks cached (10k rows in memory max)
- Server-side search and sort
- Tags embedded in the `/api/contacts` response (no separate request per page)
- Batch delete: checkbox selection + contextual action bar, up to 10,000 contacts at once
- CSV export: full server-side fetch (not limited to cached rows)
- Custom header checkbox for select-all on current page (AG Grid's built-in `headerCheckbox` is not supported with Infinite Row Model)

---

## Milestone 1d: Personal Email Integration (My Email Contacts) ✅

Users can connect their personal Gmail account to the CRM to discover contacts, import them, and auto-log email interactions.

### 1d.1 Gmail connection

- User-scoped OAuth connection (separate from login OAuth, requests `gmail.readonly`)
- OAuth tokens encrypted at rest (AES-256-GCM, `EMAIL_ENCRYPTION_KEY` env var)
- One connection per user per provider per email address
- Connection management: connect, disconnect (with token revocation), status tracking
- Provider-agnostic schema — `provider` column supports future Outlook/IMAP

### 1d.2 Email contacts table

- "My Email Contacts" sidebar item (visible to all users, InboxIcon)
- **Not connected state**: centered card with "Connect Gmail Account" button
- **Connected state**: table of everyone the user has emailed (from Gmail sent messages, not just Google Contacts)
- CRM match highlighting: contacts already in the workspace shown at the top with "In Workspace" badge
- Bulk "Add to Workspace" action for importing multiple contacts at once
- Per-contact toggles: sync interactions (on/off), visible to team (on/off)
- Search/filter within the Gmail contacts list
- Connection settings: default sync/visibility preferences, sync interval

### 1d.3 Interaction sync

- Worker task `sync_email_interactions`: fetches messages since last sync, matches to CRM contacts, creates interaction records
- Worker dispatcher `dispatch_email_syncs`: cron every minute, enqueues due sync jobs based on interval
- Manual "Sync Now" button for on-demand refresh
- Dedup via `provider_message_id` (Gmail message ID, indexed)
- Interactions store subject + snippet only (body not stored for privacy)
- Type: `email_sent` or `email_received` based on From/To matching

### 1d.4 Visibility controls

- `visible_to_team` flag on each synced interaction (default from per-contact setting)
- Your own synced emails always visible to you regardless of flag
- Other users only see interactions where `visible_to_team = true`
- Gmail-synced interactions show "Gmail" badge and "Private" indicator on contact timeline
- Per-contact settings: `email_contact_settings` table with sync/visibility toggles
- CRM contacts default to sync **on** (easy opt-out); new imports respect connection defaults

---

## Ideas / Backlog

Captured ideas for future consideration. Not prioritized yet.

### AI Email Butler (inbound email parsing)

**Concept:** The system receives emails (via BCC or a dedicated inbox like `crm@pauseai.info`) and an AI parses them to automatically log interactions and manage contacts.

**How it would work:**
1. User sends an email to a contact and adds the CRM address as BCC
2. System receives the inbound email (via Mailersend inbound routing or a dedicated mail receiver)
3. AI parses the email to extract: who it was sent to, what it's about, sentiment, action items
4. System matches the recipient against existing contacts (by email address)
5. If the contact exists → log an interaction (type: email, with parsed summary + full body)
6. If the contact is new → create the contact with whatever info can be extracted, and **send a reply email back to the user** asking for clarifications: "I noticed you emailed someone@example.com who isn't in the CRM yet. Can you tell me more about them? What's their role, which chapter are they in?" etc.
7. The user replies to that clarification email, and the AI parses the reply to fill in the contact details

**What makes this powerful:**
- Zero-friction interaction logging — just BCC the CRM, done
- The system becomes a proactive assistant ("butler") that follows up with you
- Over time it learns patterns: "You often email people from X organization, should I tag them automatically?"
- Could extend to forwarding entire email threads for bulk parsing

**Technical considerations:**
- Mailersend supports inbound routing (parse incoming emails via webhook)
- Need an LLM call (Claude API) for parsing — extract structured data from unstructured email
- Clarification flow needs a stateful email conversation (track pending questions per user)
- Privacy: emails may contain sensitive info — need clear data handling policy
- Rate limiting on AI calls to control costs

---

### AI System Pilot (autonomous CRM agent)

**Concept:** An AI agent (powered by Claude) that can autonomously pilot the entire CRM system via the API — planning and executing complex multi-step operations on behalf of a human operator.

**How it would work:**
1. Admin gives the AI a high-level goal in natural language: "Find all volunteers in Germany who haven't been contacted in 6 months and send them a re-engagement email"
2. The AI translates this into a sequence of API calls:
   - `POST /api/segments/preview` — find matching contacts
   - `POST /api/campaigns` — create the campaign
   - `POST /api/campaigns/:id/send` — trigger the send
3. The AI reports back with what it did, what decisions it made, and asks for confirmation before irreversible actions (sending emails, deleting data)

**Broader capabilities:**
- Answering questions: "How many active members do we have in France? Show me the trend over the last 3 months."
- Writing and running scripts: "Write a script that tags anyone who's attended 3+ events as 'core-activist'"
- Proactive suggestions: "I notice 200 contacts have been dormant for 90 days — want me to draft a re-engagement campaign?"
- Bulk data operations: "Import this CSV, deduplicate against existing contacts, and add the 'conference-2026' tag to all new ones"

**Technical approach:**
- Build on the Claude API using tool use — each API endpoint becomes a tool the agent can call
- The existing API key system already provides the auth layer the agent needs
- The script engine provides an alternative execution path for complex operations
- Use Claude's extended thinking for multi-step planning before execution

**What makes this powerful:**
- The full API surface is already built — the agent is just an intelligent layer on top
- No new data model needed — the agent reads and writes via the same endpoints as any other client
- Could run as a chat UI within the dashboard, or be triggered via email/Slack commands
- Dramatically lowers the barrier for non-technical staff to do complex CRM operations

**Technical considerations:**
- Tool use schema for each API endpoint (can be auto-generated from the route handlers)
- Confirmation flow for destructive or bulk operations
- Rate limiting on Claude API calls
- Logging all AI actions with full reasoning for auditability
- Sandboxing: the agent should only have the permissions of the user who invoked it

---

### ~~Hosted API documentation~~ ✅ Done

Implemented as an in-app documentation system at `/dashboard/docs`. Renders all `docs/*.md` files (including the auto-generated API reference) using `react-markdown` with syntax highlighting. Navigation sidebar with sections. Accessible to all roles via "Documentation" in the main sidebar.

---

### ~~In-app bug reports & feature requests~~ ✅ Done

Implemented as a full support ticket system at `/dashboard/support`. Any user can submit bug reports or feature requests. Admins see all tickets with stats dashboard, can change status/priority, and reply with "Staff" badge. Reply thread with closed-ticket lockout. Full REST API (8 endpoints) for API-driven usage. Workspace-scoped with proper authorization.

---

### Public contact submission page

**Concept:** A page (possibly public, or behind a simple link) that allows anyone to enter a new contact and optionally log an interaction.

**How it would work:**
- A simple form with configurable fields (name, email, notes, etc.)
- Configurable in Settings: whether new contacts go directly into the CRM or into a **staging area**
- Staging mode: new contacts appear in the contacts table with a "pending verification" flag and a `submittedBy` field showing who entered them
- A member or admin must click "Approve" to promote them to full contacts
- Could eventually support logging an interaction at the same time ("I met this person at X event")
- Tracks who submitted each contact for accountability

**Technical considerations:**
- Need a `status` field on contacts (or a `verified` boolean) and a `submittedBy` field
- Settings toggle: "Require approval for new contacts" (on/off)
- Verification queue: filtered view in the contacts table, or a dedicated page

---

### Subscription opt-in model (neutral default)

**Concept:** New contacts should NOT be automatically subscribed to all mailing lists. The current model (missing preference key = opted-in) is problematic — it means importing contacts automatically subscribes them to everything.

**Proposed model:**
- Three states per category per contact: **subscribed** (explicit opt-in), **unsubscribed** (explicit opt-out), **neutral** (no preference set)
- New contacts start in **neutral** state for all categories
- Neutral contacts are NOT included in campaign sends (conservative default)
- Admins can bulk-subscribe neutral contacts to specific categories (with confirmation)
- When a contact is being re-subscribed to something they previously **unsubscribed** from, the UI must show a warning: "This contact previously unsubscribed from [category]. Are you sure you want to re-subscribe them?"
- Data entry forms can optionally set initial subscriptions explicitly

**Technical considerations:**
- Change `communicationPreferences` from `{ category: boolean }` to `{ category: "subscribed" | "unsubscribed" }` — absence of key means neutral
- Update campaign send logic: only send to contacts where `prefs[category] === "subscribed"` (currently sends when not explicitly `false`)
- Migration: existing `true` → "subscribed", existing `false` → "unsubscribed", missing → neutral
- This is a **breaking change** to campaign behavior — needs careful rollout

---

## Open questions

- [ ] AG Grid Community vs other table libraries — need to verify license compatibility and feature set
- [ ] Email template editor — build simple one vs integrate Mailersend templates vs use something like unlayer (embeddable editor)
- [ ] How much of Milestone 2 is needed before launch? At minimum: segmentation + broadcast email
- [ ] Mobile responsiveness — how important for v1? Table views are hard on mobile.
