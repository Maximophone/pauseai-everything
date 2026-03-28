# Personal Email Integration — Design Document

> Status: Draft. Last updated: 2026-03-28.

## Overview

Users can connect their personal Gmail account to the CRM. This enables two things:

1. **Browse and import email contacts** — see everyone you've emailed, add them to the workspace with one click
2. **Auto-log email interactions** — emails sent to/from CRM contacts appear on their interaction timeline automatically

This is a **user-scoped** feature (my Gmail account), distinct from the workspace-scoped Connections system (org's Airtable/Notion). Each user connects their own account. Imported contacts belong to the workspace.

## UI: "My Email Contacts"

A new sidebar item visible to all authenticated users. The page has two states:

### State 1: Not connected

A centered card with:
- Brief explanation of what connecting does
- "Connect Gmail Account" button (triggers Google OAuth with Gmail scopes)
- Future: "Connect Outlook" button (greyed out / coming soon)

### State 2: Connected

A full-page table showing **everyone the user has emailed** (not just Google Contacts — pulled from Gmail API message history). Columns:

| Column | Description |
|--------|-------------|
| Name | From Gmail headers (parsed from "Display Name <email>") |
| Email | Email address |
| In CRM | Badge if this email matches an existing CRM contact |
| Sync Interactions | Toggle — whether email interactions are auto-logged for this contact |
| Visible to Team | Toggle — whether synced interactions are visible to other users |
| Actions | "Add to Workspace" button (for contacts not yet in CRM) |

**Behavior:**
- Contacts already in the CRM are **highlighted** and shown at the top
- For CRM contacts, "Sync Interactions" defaults to **on** (easy opt-out)
- For new contacts being added, the user picks sync/visibility at add time
- Bulk selection for adding multiple contacts at once
- Search/filter within the Gmail contacts list
- "Refresh" button to re-fetch from Gmail
- Connection settings: default sync/visibility preferences, disconnect account

## Data Model

### New tables

```sql
-- One row per user's connected email account
CREATE TABLE email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gmail',  -- 'gmail', future: 'outlook'
  provider_account_email TEXT NOT NULL,
  access_token TEXT,          -- encrypted, refreshed via refresh_token
  refresh_token TEXT NOT NULL, -- encrypted
  token_expires_at TIMESTAMPTZ,
  default_sync_interactions BOOLEAN NOT NULL DEFAULT true,
  default_interactions_visible BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected',  -- connected | error | disconnected
  status_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, provider_account_email)
);

-- Per-user per-contact interaction sync settings
CREATE TABLE email_contact_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sync_interactions BOOLEAN NOT NULL DEFAULT true,
  interactions_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email_connection_id, contact_id)
);
```

### Modified tables

```sql
-- interactions: new columns
ALTER TABLE interactions ADD COLUMN email_connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL;
ALTER TABLE interactions ADD COLUMN provider_message_id TEXT;  -- Gmail message ID, for dedup
ALTER TABLE interactions ADD COLUMN visible_to_team BOOLEAN NOT NULL DEFAULT true;

-- Index for dedup lookups
CREATE INDEX idx_interactions_provider_message ON interactions(provider_message_id) WHERE provider_message_id IS NOT NULL;
```

## Authentication Flow

Gmail integration uses a **separate OAuth flow** from the login OAuth. The login flow uses minimal scopes (email + profile). The Gmail integration needs additional scopes:

- `https://www.googleapis.com/auth/gmail.readonly` — read email messages and metadata
- `https://www.googleapis.com/auth/gmail.send` — send emails (future, Tier 3)

**Flow:**
1. User clicks "Connect Gmail Account" on the My Email Contacts page
2. Redirect to Google OAuth consent screen requesting Gmail scopes
3. Google redirects back with an auth code
4. Server exchanges code for access_token + refresh_token
5. Tokens stored in `email_connections` table (encrypted at rest)
6. Access token refreshed automatically when expired (using refresh_token)

**Important:** This is NOT the same as the NextAuth Google provider. It's a separate OAuth client flow that stores tokens in our own table, not NextAuth's `account` table. This keeps concerns separate — login auth vs. Gmail data access.

**Credential security:** Tokens must be encrypted at rest. Use AES-256-GCM with a server-side key (`EMAIL_ENCRYPTION_KEY` env var). The existing connections system stores credentials as plaintext JSON — we should not repeat that pattern for OAuth tokens that grant mailbox access.

## API Endpoints

### Email Connections

```
GET    /api/email-connections                  — list current user's connections
POST   /api/email-connections                  — create connection (after OAuth callback)
DELETE /api/email-connections/:id              — disconnect (revoke token + delete)
POST   /api/email-connections/:id/refresh      — trigger manual sync
PUT    /api/email-connections/:id/settings     — update defaults (sync/visibility)
```

### Gmail Contacts (email contacts the user has interacted with)

```
GET    /api/email-connections/:id/contacts     — list people the user has emailed
                                                 (paginated, with CRM match status)
POST   /api/email-connections/:id/contacts/import — add selected contacts to workspace
```

### Email Contact Settings

```
PUT    /api/email-contact-settings/:contactId  — update sync/visibility for a contact
GET    /api/email-contact-settings             — list all settings for current user
```

### OAuth

```
GET    /api/auth/gmail                         — initiate Gmail OAuth flow
GET    /api/auth/gmail/callback                — handle OAuth callback
```

## Interaction Sync

### How it works

1. **Dispatcher cron** (`dispatch_email_syncs`): runs every minute, finds `email_connections` that are due for sync, enqueues `sync_email_interactions` jobs
2. **Sync task** (`sync_email_interactions`): for a given email connection:
   a. Refresh access token if expired
   b. Query Gmail API for messages since `last_synced_at`
   c. For each message, check if sender or recipient matches a CRM contact with `sync_interactions = true`
   d. Check `provider_message_id` for dedup — skip if already imported
   e. Create interaction record with appropriate visibility
   f. Update `last_synced_at`
3. **Manual refresh**: same task, triggered on-demand via API

### Sync frequency

- Default: every 5 minutes (configurable per connection)
- Manual refresh: on-demand via "Refresh" button
- Rate limits: Gmail API allows ~250 quota units per user per second, `messages.list` costs 5 units — well within limits

### What gets synced

For each email:
- `type`: `email_sent` or `email_received`
- `subject`: email subject line
- `body`: email snippet (first ~200 chars) — NOT full body by default
- `occurredAt`: email date
- `metadata`: `{ provider_message_id, provider_thread_id, source: "gmail", from, to, cc }`
- `email_connection_id`: which connection synced this
- `visible_to_team`: from the contact's `email_contact_settings`

### Visibility rules

When querying interactions for a contact timeline:
- Show all interactions where `visible_to_team = true`
- Show all interactions where `email_connection.user_id = current_user` (you always see your own synced emails)
- For visible interactions from other users' Gmail syncs: show **subject + metadata only**, not body
- The full body is only shown to the Gmail account owner

### Dedup

- Primary key: `provider_message_id` (Gmail's message ID is globally unique)
- If two users have the same email in a thread (e.g., both CC'd), we create **one interaction** from the first sync that encounters it. The second sync sees the existing `provider_message_id` and skips.

## Gmail API Usage

### Fetching contacts the user has emailed

There's no single "people I've emailed" endpoint. Strategy:

1. `gmail.users.messages.list` with `q: "in:sent"` — gets all sent messages
2. Extract unique `To` / `Cc` / `Bcc` addresses from message headers
3. Deduplicate by email address
4. Parse display names from the `To` header format `"Display Name <email@example.com>"`
5. Cache this list in the database (a `gmail_cached_contacts` table or in-memory on the page) to avoid re-fetching on every page load

### Fetching email interactions

For incremental sync:
```
gmail.users.messages.list({
  userId: 'me',
  q: `after:${epochSeconds}`,  // since last sync
  maxResults: 500
})
```

Then for each message:
```
gmail.users.messages.get({
  userId: 'me',
  id: messageId,
  format: 'metadata',  // just headers, not full body
  metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date']
})
```

Full body fetched only when user clicks to expand an interaction on the timeline (on-demand, not stored).

## Implementation Plan

### Phase 1: OAuth + Connection Setup
- [ ] Schema: `email_connections` table (Drizzle)
- [ ] Token encryption utilities (`src/lib/encryption.ts`)
- [ ] Gmail OAuth flow: `/api/auth/gmail`, `/api/auth/gmail/callback`
- [ ] API: `GET/POST/DELETE /api/email-connections`
- [ ] UI: "My Email Contacts" sidebar item + page with connect/disconnect

### Phase 2: Gmail Contacts Table
- [ ] Gmail API client wrapper (`src/lib/gmail.ts`) — auth, token refresh, message fetching
- [ ] API: `GET /api/email-connections/:id/contacts` — fetch and deduplicate sent-to addresses
- [ ] API: `POST /api/email-connections/:id/contacts/import` — add to workspace
- [ ] UI: contacts table with CRM match highlighting, bulk import, search

### Phase 3: Interaction Sync Settings
- [ ] Schema: `email_contact_settings` table
- [ ] Schema: new columns on `interactions` (`email_connection_id`, `provider_message_id`, `visible_to_team`)
- [ ] API: `GET/PUT /api/email-contact-settings`
- [ ] UI: sync/visibility toggles per contact in the Gmail contacts table

### Phase 4: Interaction Sync Engine
- [ ] Worker task: `sync_email_interactions` — fetch Gmail messages, match to contacts, create interactions
- [ ] Worker task: `dispatch_email_syncs` — cron dispatcher
- [ ] Dedup logic via `provider_message_id`
- [ ] Visibility filtering in interaction timeline queries
- [ ] API: `POST /api/email-connections/:id/refresh` — manual sync trigger
- [ ] UI: "Refresh" button, last synced timestamp display

### Phase 5: Timeline Integration
- [ ] Update interaction timeline component to show Gmail-synced interactions
- [ ] Visual indicator for synced vs manually logged interactions (Gmail icon)
- [ ] "Subject only" view for team members viewing others' synced interactions
- [ ] Per-interaction visibility toggle and delete for the connection owner
- [ ] Body expansion on-demand (fetches from Gmail API, not stored)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EMAIL_ENCRYPTION_KEY` | AES-256 key for encrypting OAuth tokens. Generate: `openssl rand -hex 32` |
| `AUTH_GOOGLE_ID` | Same Google OAuth client ID (already exists) |
| `AUTH_GOOGLE_SECRET` | Same Google OAuth client secret (already exists) |

The Google OAuth client in Google Cloud Console needs the Gmail API enabled and the additional scopes added to the consent screen.

## Security Considerations

- OAuth tokens encrypted at rest (AES-256-GCM)
- Refresh tokens are long-lived — if compromised, attacker gets mailbox read access. Encryption is critical.
- Users can revoke access at any time (disconnect). This also revokes the Google token.
- Email body content is NOT stored in the database by default — only subject + snippet. Full body is fetched on-demand from Gmail API.
- The `visible_to_team` flag ensures users control what colleagues can see
- Admin visibility: admins can see that a user has connected Gmail and sync statistics, but cannot read synced email content

## Known Issues & Improvements (from first testing, 2026-03-28)

### Interactions display
- Only emails **sent by** the user are synced — received emails are missing. The sync should include both directions.
- No visual indicator on the interaction timeline showing whether an interaction is **visible to all** or **private to the user**. Users need to see and control this at a glance.
- Visibility should be controllable **per interaction** (not just per contact). A user may want most interactions with a contact to be visible but flag specific sensitive ones as private.
- The overall interactions UX needs a design pass — think about what information is most useful and how to present it.

### My Email Contacts page
- Junk/automated email addresses (e.g. `01000199a213f3cd-...@send.happenstance.fyi`) appear at the top of the list because they start with numbers. Need filtering or sorting improvements — consider deprioritizing addresses that look automated (noreply, UUIDs, tracking domains).
- When adding a Gmail contact to the CRM, the user should be able to **edit the name** before importing. Gmail header names can be incorrect, missing, or formatted oddly.

### Contact detail page integration
- When viewing a contact, if the current user has a connected Gmail account, the system should check whether the contact's email appears in their Gmail history. If so, show a prompt/button to enable interaction syncing for that contact — a quick entry point without needing to go through the My Email Contacts page.

## What This Does NOT Cover

- **Sending emails via Gmail** (Tier 3) — future enhancement
- **Full inbox UI** (Tier 4) — deferred indefinitely
- **Outlook / IMAP support** — future, but the schema is provider-agnostic (`provider` column)
- **Two-user dedup edge cases** — if two users sync the same thread, first one wins. May need refinement.
- **Google Workspace admin consent** — some orgs require domain-wide delegation. Out of scope for now.
