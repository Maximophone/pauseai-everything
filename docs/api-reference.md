# API Reference

> Auto-generated from Zod schemas. Run `npm run docs:api` to regenerate.

## Authentication

Two auth methods are supported:
- **Session cookie** (browser): Managed by NextAuth with Google OAuth
- **API key** (machine-to-machine): `Authorization: Bearer pai_<key>`

Auth levels:
- **No auth**: Public endpoint
- **Session**: Any authenticated user
- **Admin**: Requires admin role (returns 403 otherwise)

## Error Format

```json
{ "error": "message", "details": ["field-level errors (optional)"] }
```

## Contacts

### `GET /api/contacts`

List contacts with search, pagination, and sorting. No auth required

**Response:** { contacts: Contact[], total: number, page: number, pageSize: number }

### `POST /api/contacts`

Create a new contact. No auth required

**Request body** (`CreateContactInput`):
```
{
  "email": string (email) | null?,
  "firstName": string | null?,
  "lastName": string | null?,
  "customFields": Record<string, string>
}
```

**Response:** Contact (201)

**Errors:** `400 validation`, `409 duplicate email`

### `GET /api/contacts/:id`

Get a single contact by ID. No auth required

**Response:** Contact

**Errors:** `404 not found`

### `PUT /api/contacts/:id`

Update a contact (partial update). No auth required

**Request body** (`UpdateContactInput`):
```
{
  "email": string (email) | null?,
  "firstName": string | null?,
  "lastName": string | null?,
  "language": string | null?,
  "globallyUnsubscribed": boolean?,
  "customFields": Record<string, string>?,
  "communicationPreferences": Record<string, string>?
}
```

**Response:** Contact

**Errors:** `400 validation`, `404 not found`

### `DELETE /api/contacts/:id`

Delete a contact. Requires workspace admin role. Global admins delete the contact globally; workspace admins remove it from their workspace only (the contact record is deleted if it has no remaining workspace links).

**Auth:** Workspace admin (via `X-Workspace-Id` header)

**Response:** { success: true }

**Errors:** `403 forbidden`, `404 not found`

### `POST /api/contacts/import`

Bulk import contacts from CSV data. No auth required

**Request body** (`ImportContactsInput`):
```
{
  "rows": Record<string, string>[],
  "mapping": Record<string, string>,
  "skipDuplicates": boolean
}
```

**Response:** { total, created, updated, skipped, errors: [{row, error}] }

**Errors:** `400 validation`

### `GET /api/contacts/:id/interactions`

List interactions for a contact (paginated). No auth required

**Response:** { interactions: Interaction[], total, page, pageSize }

**Errors:** `404 contact not found`

### `POST /api/contacts/:id/interactions`

Create an interaction for a contact. No auth required

**Request body** (`CreateInteractionInput`):
```
{
  "type": "email_sent" | "email_received" | "call" | "meeting" | "note" | "form_submission" | "event_attended" | "action_taken" | "stage_change",
  "subject": string | null?,
  "body": string | null?,
  "occurredAt": string (datetime)?,
  "metadata": Record<string, string>
}
```

**Response:** Interaction (201)

**Errors:** `400 validation`, `404 contact not found`

### `GET /api/contacts/:id/tags`

List tags for a contact. No auth required

**Response:** Tag[]

**Errors:** `404 contact not found`

### `POST /api/contacts/:id/tags`

Add a tag to a contact. No auth required

**Request body** (`ContactTagInput`):
```
{
  "tagId": string (uuid)
}
```

**Response:** Tag[] (updated list)

**Errors:** `400 validation`, `404 contact not found`

### `DELETE /api/contacts/:id/tags`

Remove a tag from a contact. No auth required

**Request body** (`ContactTagInput`):
```
{
  "tagId": string (uuid)
}
```

**Response:** Tag[] (updated list)

**Errors:** `400 validation`

### `GET /api/contacts/tags?ids=uuid1,uuid2`

Get tags for multiple contacts (batch). No auth required

**Response:** Record<contactId, Tag[]>

## Interactions

### `DELETE /api/interactions/:id`

Delete an interaction. No auth required

**Response:** { success: true }

**Errors:** `404 not found`

## Tags

### `GET /api/tags`

List all tags. No auth required

**Response:** Tag[]

### `POST /api/tags`

Create a tag. No auth required

**Request body** (`CreateTagInput`):
```
{
  "name": string,
  "color": string | null?
}
```

**Response:** Tag (201)

**Errors:** `400 validation`, `409 duplicate name`

### `PUT /api/tags/:id`

Update a tag. No auth required

**Request body** (`UpdateTagInput`):
```
{
  "name": string?,
  "color": string | null?
}
```

**Response:** Tag

**Errors:** `404 not found`

### `DELETE /api/tags/:id`

Delete a tag. No auth required

**Response:** { success: true }

**Errors:** `404 not found`

## Fields

### `GET /api/fields`

List all custom field definitions. No auth required

**Response:** FieldDefinition[]

### `POST /api/fields`

Create a custom field definition. No auth required

**Request body** (`CreateFieldInput`):
```
{
  "name": string,
  "label": string,
  "fieldType": "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url" | "email",
  "options": string[] | null?,
  "required": boolean,
  "sortOrder": number,
  "scope": "core" | "global_internal" | "workspace"?,
  "workspaceId": string (uuid) | null?
}
```

**Response:** FieldDefinition (201)

**Errors:** `400 validation`, `409 duplicate name`

### `PUT /api/fields/:id`

Update a field definition. No auth required

**Request body** (`UpdateFieldInput`):
```
{
  "label": string?,
  "fieldType": "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url" | "email"?,
  "options": string[] | null?,
  "required": boolean?,
  "sortOrder": number?
}
```

**Response:** FieldDefinition

**Errors:** `404 not found`

### `DELETE /api/fields/:id`

Delete a field definition. No auth required

**Response:** { success: true }

**Errors:** `404 not found`

## Segments

### `GET /api/segments`

List all segments. **Auth: Session**

**Response:** Segment[]

### `POST /api/segments`

Create a segment. **Auth: Admin**

**Request body** (`CreateSegmentInput`):
```
{
  "name": string,
  "description": string | null?,
  "filter": {
    "match": "all" | "any",
    "conditions": {
      "field": string,
      "operator": string,
      "value": unknown
    }[]
  },
  "crossWorkspace": boolean?
}
```

**Response:** Segment (201)

**Errors:** `400 validation`

### `GET /api/segments/:id`

Get a single segment. **Auth: Session**

**Response:** Segment

**Errors:** `404 not found`

### `PUT /api/segments/:id`

Update a segment. **Auth: Admin**

**Request body** (`UpdateSegmentInput`):
```
{
  "name": string?,
  "description": string | null?,
  "filter": {
    "match": "all" | "any",
    "conditions": {
      "field": string,
      "operator": string,
      "value": unknown
    }[]
  }?,
  "crossWorkspace": boolean?
}
```

**Response:** Segment

**Errors:** `404 not found`

### `DELETE /api/segments/:id`

Delete a segment. **Auth: Admin**

**Response:** { success: true }

**Errors:** `404 not found`

### `POST /api/segments/preview`

Preview contacts matching a segment filter. **Auth: Session**

**Request body** (`SegmentPreviewInput`):
```
{
  "filter": {
    "match": "all" | "any",
    "conditions": {
      "field": string,
      "operator": string,
      "value": unknown
    }[]
  }
}
```

**Response:** { contacts: Contact[], total: number }

**Errors:** `400 validation`

## Campaigns

### `GET /api/campaigns`

List all campaigns. **Auth: Session**

**Response:** Campaign[]

### `POST /api/campaigns`

Create a campaign. **Auth: Admin**

**Request body** (`CreateCampaignInput`):
```
{
  "name": string,
  "subject": string,
  "body": string,
  "fromName": string | null?,
  "fromEmail": string (email) | null?,
  "segmentId": string (uuid) | null?,
  "categoryId": string (uuid) | null?,
  "scheduledAt": string (datetime) | null?
}
```

**Response:** Campaign (201)

**Errors:** `400 validation`

### `GET /api/campaigns/:id`

Get a single campaign. **Auth: Session**

**Response:** Campaign

**Errors:** `404 not found`

### `PUT /api/campaigns/:id`

Update a campaign. **Auth: Admin**

**Request body** (`UpdateCampaignInput`):
```
{
  "name": string?,
  "subject": string?,
  "body": string?,
  "fromName": string | null?,
  "fromEmail": string (email) | null?,
  "segmentId": string (uuid) | null?,
  "categoryId": string (uuid) | null?,
  "scheduledAt": string (datetime) | null?
}
```

**Response:** Campaign

**Errors:** `404 not found`

### `DELETE /api/campaigns/:id`

Delete a campaign. **Auth: Admin**

**Response:** { success: true }

**Errors:** `404 not found`

### `POST /api/campaigns/:id/send`

Queue a draft campaign for sending. **Auth: Admin**

**Response:** { queued: true, message: "Campaign queued for sending." }

**Errors:** `400 already sent`, `404 not found`

### `POST /api/campaigns/:id/preview`

Send a preview email for a campaign. **Auth: Admin**

**Request body** (`CampaignPreviewInput`):
```
{
  "email": string (email)
}
```

**Response:** { success: true }

**Errors:** `400 validation/send error`

### `GET /api/campaigns/:id/emails`

List email records for a campaign. **Auth: Session**

**Response:** Email[]

## Scripts

### `GET /api/scripts`

List all scripts. **Auth: Admin**

**Response:** Script[]

### `POST /api/scripts`

Create a script. **Auth: Admin**

**Request body** (`CreateScriptInput`):
```
{
  "name": string,
  "description": string | null?,
  "code": string,
  "cronSchedule": string | null?
}
```

**Response:** Script (201)

**Errors:** `400 validation`

### `GET /api/scripts/:id`

Get a single script. **Auth: Admin**

**Response:** Script

**Errors:** `404 not found`

### `PUT /api/scripts/:id`

Update a script. **Auth: Admin**

**Request body** (`UpdateScriptInput`):
```
{
  "name": string?,
  "description": string | null?,
  "code": string?,
  "cronSchedule": string | null?,
  "enabled": boolean?
}
```

**Response:** Script

**Errors:** `404 not found`

### `DELETE /api/scripts/:id`

Delete a script. **Auth: Admin**

**Response:** { ok: true }

**Errors:** `404 not found`

### `POST /api/scripts/:id/run`

Execute a script manually. **Auth: Admin**

**Response:** ScriptRun

### `GET /api/scripts/:id/runs`

Get run history for a script. **Auth: Admin**

**Response:** ScriptRun[]

## Automations

### `GET /api/automations`

List all automation rules. **Auth: Admin**

**Response:** AutomationRule[]

### `POST /api/automations`

Create an automation rule. **Auth: Admin**

**Request body** (`CreateAutomationInput`):
```
{
  "name": string,
  "description": string | null?,
  "config": {
    "match": "all" | "any",
    "conditions": {
      "field": string,
      "operator": string,
      "value": unknown
    }[],
    "actions": {
      "type": "set_field",
      "field": string,
      "value": unknown
    } | {
      "type": "add_tag",
      "tag": string
    } | {
      "type": "remove_tag",
      "tag": string
    }[]
  }
}
```

**Response:** AutomationRule (201)

**Errors:** `400 validation`

### `GET /api/automations/:id`

Get a single automation rule. **Auth: Admin**

**Response:** AutomationRule

**Errors:** `404 not found`

### `PUT /api/automations/:id`

Update an automation rule. **Auth: Admin**

**Request body** (`UpdateAutomationInput`):
```
{
  "name": string?,
  "description": string | null?,
  "config": {
    "match": "all" | "any",
    "conditions": {
      "field": string,
      "operator": string,
      "value": unknown
    }[],
    "actions": {
      "type": "set_field",
      "field": string,
      "value": unknown
    } | {
      "type": "add_tag",
      "tag": string
    } | {
      "type": "remove_tag",
      "tag": string
    }[]
  }?,
  "isActive": boolean?
}
```

**Response:** AutomationRule

**Errors:** `404 not found`

### `DELETE /api/automations/:id`

Delete an automation rule. **Auth: Admin**

**Response:** { success: true }

**Errors:** `404 not found`

### `POST /api/automations/:id/run`

Execute an automation rule now. **Auth: Admin**

**Response:** { affected: number }

**Errors:** `404 not found`

## Users

### `GET /api/users`

List all users. **Auth: Admin**

**Response:** { id, name, email, image, isAdmin }[]

### `PUT /api/users/:id`

Update user role. **Auth: Admin**

**Request body** (`UpdateUserInput`):
```
{
  "role": "admin" | "member" | "viewer"
}
```

**Response:** { id, name, email, isAdmin }

**Errors:** `400 validation`, `404 not found`

## Api-keys

### `GET /api/api-keys`

List all API keys (hashes hidden). **Auth: Admin**

**Response:** { id, name, keyPrefix, userId, isActive, lastUsedAt, createdAt }[]

### `POST /api/api-keys`

Create an API key (raw key returned once). **Auth: Admin**

**Request body** (`CreateApiKeyInput`):
```
{
  "name": string
}
```

**Response:** { id, name, keyPrefix, rawKey, createdAt } (201)

**Errors:** `400 validation`

### `DELETE /api/api-keys/:id`

Revoke an API key. **Auth: Admin**

**Response:** { success: true }

**Errors:** `404 not found`

## Support-tickets

### `GET /api/support-tickets`

List all support tickets with optional filters, sorting by newest or most voted. **Auth: Session**

**Response:** { tickets: Ticket[], total, stats: { open, in_progress, resolved, closed } }

### `POST /api/support-tickets`

Create a support ticket (creator is auto-subscribed to notifications). **Auth: Session**

**Request body** (`CreateTicketInput`):
```
{
  "title": string,
  "description": string,
  "type": "bug" | "feature",
  "priority": "low" | "medium" | "high"?
}
```

**Response:** Ticket (201)

**Errors:** `400 validation`

### `GET /api/support-tickets/:id`

Get a ticket with replies, vote status, and subscription status. **Auth: Session**

**Response:** { ticket: Ticket & { hasVoted }, replies: Reply[], isSubscribed }

**Errors:** `404 not found`

### `PUT /api/support-tickets/:id`

Update a ticket (admin: status/priority/type; owner: title/desc on open tickets). **Auth: Session**

**Request body** (`UpdateTicketInput`):
```
{
  "title": string?,
  "description": string?,
  "type": "bug" | "feature"?,
  "status": "open" | "in_progress" | "resolved" | "closed"?,
  "priority": "low" | "medium" | "high"?
}
```

**Response:** Ticket

**Errors:** `400 validation`, `403 not authorized`, `404 not found`

### `DELETE /api/support-tickets/:id`

Delete a ticket and all its replies (admin only). **Auth: Admin**

**Response:** { success: true }

**Errors:** `403 not admin`, `404 not found`

### `GET /api/support-tickets/:id/replies`

List replies for a ticket. **Auth: Session**

**Response:** Reply[]

**Errors:** `404 not found`

### `POST /api/support-tickets/:id/replies`

Post a reply to a ticket (replier is auto-subscribed to notifications). **Auth: Session**

**Request body** (`CreateTicketReplyInput`):
```
{
  "body": string
}
```

**Response:** Reply (201)

**Errors:** `400 validation`, `404 not found`

### `POST /api/support-tickets/:id/vote`

Toggle upvote on a ticket (one vote per user). **Auth: Session**

**Response:** { upvoted: boolean, upvoteCount: number }

### `POST /api/support-tickets/:id/subscribe`

Subscribe to email notifications for a ticket. **Auth: Session**

**Response:** { subscribed: true }

### `DELETE /api/support-tickets/:id/subscribe`

Unsubscribe from email notifications for a ticket. **Auth: Session**

**Response:** { subscribed: false }

### `GET /api/support-tickets/unsubscribe`

One-click unsubscribe from ticket notifications via email link (HMAC token). No auth required

**Response:** HTML confirmation page

**Errors:** `400 missing params`, `403 invalid token`

### `GET /api/support-tickets/subscribe-all`

Get current user's global subscription status for all tickets. **Auth: Session**

**Response:** { subscribedToAll: boolean }

### `POST /api/support-tickets/subscribe-all`

Toggle global subscription to all ticket notifications. **Auth: Session**

**Response:** { subscribedToAll: boolean }

### `GET /api/support-tickets/stats`

Get ticket counts by status (global, cross-workspace). **Auth: Session**

**Response:** { open: number, in_progress: number, resolved: number, closed: number }

## Webhooks

### `POST /api/webhooks/mailersend`

Receive MailerSend delivery events (sent, delivered, bounced, opened, clicked). No auth required

**Response:** { ok: true }

### `POST /api/webhooks/tally`

Receive Tally form submissions, creates/updates contacts and logs interactions. No auth required

**Response:** { status: "created"|"updated", contactId }

**Errors:** `400 invalid JSON / no email`

## Appendix: Segment Filter Schema

Used in segment creation and preview endpoints:
```
{
  "match": "all" | "any",
  "conditions": {
    "field": string,
    "operator": string,
    "value": unknown
  }[]
}
```

Supported operators: `eq`, `neq`, `contains`, `not_contains`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in`, `has_tag`, `not_has_tag`, `is_empty`, `is_not_empty`, `after`, `before`
