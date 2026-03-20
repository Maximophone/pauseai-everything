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
  "customFields": Record<string, string>?,
  "communicationPreferences": Record<string, boolean>?
}
```

`communicationPreferences` maps category names to opt-in/out status. Example: `{ "newsletter": true, "events": false }`. Missing keys default to opted-in.

**Response:** Contact

**Errors:** `400 validation`, `404 not found`

### `DELETE /api/contacts/:id`

Delete a contact. No auth required

**Response:** { success: true }

**Errors:** `404 not found`

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
  "sortOrder": number
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
  }
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
  }?
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

`categoryId` links the campaign to a communication category. When set, the campaign respects contact opt-out preferences, and `{{unsubscribe}}` merge variables resolve to a working unsubscribe URL. When `null`, the campaign is transactional (no unsubscribe, no preference filtering).

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

### `GET /api/campaigns/:id/recipients`

Preview who would receive this campaign based on its segment and category. Contacts who opted out of the campaign's category are included but flagged. **Auth: Session**

**Response:**
```
{
  "count": number,
  "activeCount": number,
  "unsubscribedCount": number,
  "recipients": [
    { "id": string, "email": string, "firstName": string, "lastName": string, "unsubscribed": boolean }
  ]
}
```

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
  "isAdmin": boolean
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

## Webhooks

### `POST /api/webhooks/mailersend`

Receive MailerSend delivery events (sent, delivered, bounced, opened, clicked, unsubscribed). No auth required

When an `activity.unsubscribed` event is received, the system looks up the campaign's category and sets that category to `false` in the contact's `communicationPreferences`.

**Response:** { ok: true }

### `POST /api/webhooks/tally`

Receive Tally form submissions, creates/updates contacts and logs interactions. No auth required

**Response:** { status: "created"|"updated", contactId }

**Errors:** `400 invalid JSON / no email`

## Communication Categories

### `GET /api/communication-categories`

List all email categories. **Auth: Session**

**Response:** Category[]

### `POST /api/communication-categories`

Create a new email category. **Auth: Admin**

**Request body** (`CreateCategoryInput`):
```
{
  "name": string (slug, lowercase, hyphens allowed),
  "label": string,
  "description": string?,
  "sortOrder": number?
}
```

**Response:** Category (201)

**Errors:** `400 validation`, `409 duplicate name`

### `GET /api/communication-categories/:id`

Get a single category. **Auth: Session**

**Response:** Category

**Errors:** `404 not found`

### `PUT /api/communication-categories/:id`

Update a category. **Auth: Admin**

**Request body** (`UpdateCategoryInput`):
```
{
  "label": string?,
  "description": string?,
  "sortOrder": number?
}
```

**Response:** Category

**Errors:** `404 not found`

### `DELETE /api/communication-categories/:id`

Delete a category. **Auth: Admin**

**Response:** { success: true }

**Errors:** `404 not found`

## Unsubscribe (Public)

### `POST /api/unsubscribe`

Process an unsubscribe request. Authenticated by HMAC token (no session required). **Auth: None (token-authenticated)**

**Request body** (`UnsubscribeInput`):
```
{
  "contactId": string (uuid),
  "category": string,
  "token": string (hex HMAC),
  "preferences": Record<string, boolean>?
}
```

If `preferences` is provided, all specified categories are updated. Otherwise, only the specified `category` is set to `false` (one-click unsubscribe).

**Response:** { success: true }

**Errors:** `400 validation`, `403 invalid token`, `404 contact not found`

### `GET /api/unsubscribe/preferences?contact=:id&token=:token&category=:name`

Get a contact's subscription status for all categories. Authenticated by HMAC token. **Auth: None (token-authenticated)**

**Response:**
```
{
  "categories": [
    { "name": string, "label": string, "description": string, "subscribed": boolean }
  ]
}
```

**Errors:** `400 missing params`, `403 invalid token`

## Settings

### `GET /api/settings`

Get all app-level settings as key-value pairs. **Auth: Session**

**Response:** Record<string, string>

### `PUT /api/settings`

Update one or more settings (upsert). **Auth: Admin**

**Request body:** `Record<string, string>`

Example:
```
{
  "mailersend_list_unsubscribe_enabled": "true"
}
```

**Response:** Record<string, string> (all settings after update)

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
