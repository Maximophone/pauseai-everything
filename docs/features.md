# PauseAI Everything App — Features

> Living document. Last updated: 2026-03-15.

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

**Roles (v1 — keep it simple):**
- **Admin:** Full access. Manage contacts, send campaigns, configure fields, manage users.
- **Member:** Can view contacts, log interactions, edit contact fields. Cannot send campaigns, manage field definitions, or manage users.

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

### 2.2 Broadcast email
- Select a segment or saved filter as audience
- Compose email (subject + rich text body) or pick a template
- Merge fields (e.g. {{name}}, {{country}}, any custom field)
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

## Milestone 4: Extended features (future)

- **AI natural language querying** — "show me all French volunteers who joined this year"
- **AI interaction summarization** — paste an email thread, AI extracts key details and logs it
- **Discord integration** — bot tracks activity, logs as interactions
- **Public volunteer dashboard** — volunteers log in, see their profile, upcoming actions
- **Event management** — create events, track RSVPs, record attendance
- **Chapter management** — chapters as first-class entities with dashboards
- **Donor management** — donation tracking, receipts, reports
- **Notion integration** — bidirectional links, maybe surface CRM data in Notion

---

## Open questions

- [ ] AG Grid Community vs other table libraries — need to verify license compatibility and feature set
- [ ] Email template editor — build simple one vs integrate Mailersend templates vs use something like unlayer (embeddable editor)
- [ ] How much of Milestone 2 is needed before launch? At minimum: segmentation + broadcast email
- [ ] Mobile responsiveness — how important for v1? Table views are hard on mobile.
