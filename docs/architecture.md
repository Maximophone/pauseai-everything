# PauseAI Everything App — Architecture

> Living document. Last updated: 2026-03-15.

## Vision

A custom-built platform for PauseAI Global that starts as a CRM and grows into the central operational hub for the organization. Built incrementally, designed to be extended.

## System boundaries

```
┌─────────────────────────────────────────────────────┐
│                 PauseAI Everything App               │
│                                                      │
│  Contacts, lifecycle stages, interactions,           │
│  segments, campaigns, email orchestration,           │
│  admin dashboard, background jobs                    │
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
- Background jobs and automations

**External services:**
- **Mailersend** — sends the actual emails. The app tells it what to send to whom.
- **Tally** — collects form submissions. Sends webhooks to the app on new joins.
- **Notion** — stays as docs, strategy, meeting notes, project boards. Not a data store for the app. Connected via hyperlinks, not data sync (e.g., a contact profile links to a relevant Notion page and vice versa).
- **n8n** — available for edge-case automations but not a core dependency. The app handles its own scheduling and jobs.

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | Best AI coding support, huge ecosystem, handles both UI and API |
| Language | TypeScript | Type safety, good DX, well-supported by AI tools |
| Database | PostgreSQL | Relational data (contacts, interactions, stages), great for complex queries/segments, scales easily to 100k+ records |
| Job queue | graphile-worker or pgboss | Postgres-backed — no extra infrastructure. Handles scheduled jobs, background tasks, batch operations |
| ORM | Drizzle or Prisma | TBD — Drizzle is lighter and closer to SQL, Prisma has better DX for rapid prototyping |
| Auth | NextAuth.js (Auth.js) | Simple, 5-10 admin users. Can start with email magic links or Google OAuth |
| Email sending | Mailersend API | Already in use, has good API for bulk/transactional email |
| Hosting | Railway or Render | Supports web process + worker process + cron from one repo. Postgres included. Simple git-push deploys |
| Form intake | Tally webhooks | Already in use for join forms |

## Architecture: Web + Worker

Two processes from the same codebase, sharing the same Postgres database.

```
┌──────────────────────────────────────┐
│            Web Process               │
│         (Next.js server)             │
│                                      │
│  Routes:                             │
│  - /dashboard — admin UI             │
│  - /api/webhooks/tally — intake      │
│  - /api/contacts — CRUD              │
│  - /api/campaigns — create/send      │
│  - /api/segments — query builder     │
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
│  Picks up jobs from queue:           │
│  - send_campaign_batch               │
│  - send_onboarding_email             │
│  - process_tally_submission          │
│  - check_churn                       │
│  - update_engagement_scores          │
│                                      │
│  Cron-triggered jobs:                │
│  - Daily: churn detection scan       │
│  - Daily: drip campaign advancement  │
│  - Weekly: engagement scoring        │
│  - Monthly: dormant contact flagging │
└──────────────────────────────────────┘
```

### Why Postgres for the job queue?

At our scale (tens of thousands of contacts, maybe dozens of jobs per hour at peak), a Postgres-backed queue is more than sufficient. It avoids adding Redis or a separate message broker, keeping infrastructure to two things: the app and the database.

Libraries like `graphile-worker` or `pgboss` provide:
- Delayed/scheduled jobs
- Retries with backoff
- Cron schedules
- Job deduplication
- Concurrency control

## Core data model (draft)

### Flexible fields system

The app uses a **JSONB + field definitions** pattern — similar to how Airtable/Notion databases work. Admins can add, remove, and reconfigure fields from the UI without code changes or migrations.

```
field_definitions
├── id (uuid)
├── slug (unique, e.g. "country", "lifecycle_stage", "party_affiliation")
├── label (display name, e.g. "Country")
├── field_type (enum: text, number, date, email, url, select, multi_select, boolean, jsonb)
├── options (jsonb, nullable — for select/multi_select: list of allowed values)
├── applies_to (jsonb array — which contact types this field appears on, e.g. ["member", "politician"], or null = all)
├── required (boolean)
├── show_in_list (boolean — display in contact list table)
├── sort_order (integer — controls field ordering in forms/views)
├── created_at
├── updated_at
```

Contacts store all field values in a single JSONB column, keyed by field slug:

```
contacts
├── id (uuid)
├── email (unique — the only hardcoded field besides name, used for deduplication)
├── name
├── fields (jsonb — all custom field values, e.g. {"country": "DE", "lifecycle_stage": "active", "skills": ["policy", "comms"], "hours_committed": 5})
├── created_at
├── updated_at

-- Example contact.fields value:
-- {
--   "country": "DE",
--   "chapter": "pauseai-germany",
--   "lifecycle_stage": "active",
--   "contact_types": ["member", "donor"],
--   "skills": ["policy", "communications"],
--   "hours_committed": 5,
--   "motivation_level": "high",
--   "source": "website_join_form",
--   "joined_at": "2026-01-15",
--   "last_interaction_at": "2026-03-10",
--   "party": null,
--   "ai_policy_position": null
-- }
```

**Indexing:** GIN index on `contacts.fields` enables fast querying. For frequently-filtered fields (e.g. `lifecycle_stage`, `country`), we can add expression indexes:
```sql
CREATE INDEX idx_contacts_country ON contacts ((fields->>'country'));
CREATE INDEX idx_contacts_lifecycle ON contacts ((fields->>'lifecycle_stage'));
CREATE INDEX idx_contacts_fields ON contacts USING GIN (fields);
```

**Validation:** The app validates field values against `field_definitions` on write — enforcing types, required fields, and allowed values for selects.

```
chapters
├── id
├── name
├── country
├── lead_contact_id (FK)

interactions
├── id
├── contact_id (FK)
├── type (enum: email_sent, email_received, call, meeting, discord_message, note, event_attended, form_submitted, ...)
├── subject
├── body/notes (text)
├── logged_by (user FK)
├── occurred_at
├── metadata (jsonb)

tags
├── id
├── name
├── category (optional grouping)

contact_tags (join table)
├── contact_id
├── tag_id

campaigns
├── id
├── name
├── type (enum: broadcast, drip_sequence, one_off)
├── status (draft, scheduled, sending, sent, cancelled)
├── segment_query (jsonb — the filter criteria)
├── email_template_id
├── scheduled_for
├── sent_at
├── stats (jsonb — opens, clicks, replies)

campaign_recipients
├── campaign_id
├── contact_id
├── status (pending, sent, delivered, opened, clicked, bounced, unsubscribed)
├── sent_at

email_templates
├── id
├── name
├── subject
├── body (html/mjml)
├── variables (jsonb — available merge fields)

drip_sequences
├── id
├── name
├── trigger (enum: on_join, manual, tag_added, stage_changed, ...)
├── steps (jsonb array of {delay, template_id, condition})

lifecycle_transitions (audit log)
├── id
├── contact_id
├── from_stage
├── to_stage
├── reason
├── triggered_by (automation or user)
├── occurred_at

users (app admins)
├── id
├── email
├── name
├── role (enum: admin, chapter_lead, viewer)
```

### Design notes

- **Unified contact record:** A contact can be a member AND a journalist AND a donor. The `contact_types` field (multi_select) handles this. Deduplication is by email.
- **Admin-configurable schema:** Field definitions are data, not code. Admins add/remove/reorder fields from the dashboard. The UI renders forms and list columns dynamically from `field_definitions`.
- **Type-specific fields:** A field can be scoped to certain contact types via `applies_to`. E.g., "party affiliation" only shows for politicians, "skills" only for members. The UI shows/hides fields accordingly.
- **Segment queries stored as data:** Campaign targeting is a saved query (jsonb), not a hardcoded list. This means segments are dynamic — always evaluated at send time against current data.
- **Interaction log is append-only:** Never delete interaction history. This is the relationship memory.
- **Lifecycle transitions are audited:** Every stage change is logged with who/what triggered it and why.
- **Tags vs fields:** Tags are lightweight labels (many-to-many, fast to add/remove). Fields are structured data with types and validation. Both are useful — tags for ad-hoc categorization, fields for structured data that needs querying.

## Segments and querying

A core feature: the ability to define complex audience segments for campaigns and reporting.

A segment is a set of filter conditions, stored as JSON:

```json
{
  "and": [
    { "field": "fields.country", "op": "eq", "value": "DE" },
    { "field": "fields.lifecycle_stage", "op": "in", "value": ["active", "highly_active"] },
    { "field": "fields.joined_at", "op": "gte", "value": "2026-01-01" },
    { "field": "tags", "op": "includes", "value": "attended_event" }
  ]
}
```

This translates to SQL like:
```sql
WHERE fields->>'country' = 'DE'
  AND fields->>'lifecycle_stage' IN ('active', 'highly_active')
  AND (fields->>'joined_at')::date >= '2026-01-01'
  AND id IN (SELECT contact_id FROM contact_tags JOIN tags ON ... WHERE tags.name = 'attended_event')
```

Supports AND/OR nesting. This gives us:
- Dynamic segments (always reflects current data)
- Saveable/reusable segments
- Campaign targeting that's always fresh
- Natural language → segment query (future AI feature)

## Access control

Simple role-based model for now:

| Role | Can do |
|---|---|
| Admin | Everything — full CRUD, send campaigns, manage users |
| Chapter Lead | View/edit contacts in their chapter. Log interactions. Cannot send global campaigns. |
| Viewer | Read-only access to contacts and reports |

Auth via NextAuth.js. Start with Google OAuth (everyone has Google). Add magic link later if needed.

## Hosting and deployment

**Target: Railway or Render** (to be decided during implementation)

Deployment topology:
- **Web service** — Next.js app (dashboard + API)
- **Worker service** — Node.js process running the job queue consumer
- **PostgreSQL** — managed instance on the same platform
- **Cron** — platform-native cron triggers or worker-internal scheduling

All from one git repo. Push to `main` → both services redeploy.

Estimated cost at launch: ~$10–20/month (well within budget).

## Migration path from Airtable

1. Export all contacts from Airtable as CSV
2. Write a migration script that maps Airtable fields → our contact schema
3. Import into Postgres
4. Set up Tally webhook to point to the new app (instead of Airtable)
5. Run old and new systems in parallel briefly to validate
6. Cut over

## What's NOT in v1

- Public-facing pages (the SvelteKit website stays separate)
- Donor payment processing
- Event management (track attendance via interactions, but no event RSVP system)
- Discord integration (future — would be valuable for tracking engagement)
- AI features (natural language querying, smart segmentation — planned but not v1)
- Notion sync (just hyperlinks for now)

## Open questions

- [ ] ORM choice: Drizzle vs Prisma?
- [ ] Hosting: Railway vs Render? (Leaning Railway for simplicity)
- [ ] Job queue: graphile-worker vs pgboss?
- [ ] Email template authoring: build a simple editor or use Mailersend's template system?
- [ ] How to handle Mailersend webhooks (delivery/open/click tracking back into our system)?
- [ ] Do we want real-time features (e.g., live dashboard updates)? Probably not v1.
