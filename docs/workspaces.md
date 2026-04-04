# Workspace Model — Design Specification

## Context

PauseAI Global is a federation: one global entity (UK-based) and semi-autonomous national chapters (France, UK, Germany, etc.). The CRM currently operates as a single-tenant system. We need to add multi-tenancy ("workspaces") so that each chapter can manage their own contacts, campaigns, and workflows independently, while Global retains oversight and aggregate reporting capabilities.

This must be built now, before the codebase grows further, because workspace scoping will touch nearly every API route, query, and UI component. Retrofitting later would require rewriting most of the application.

## Legal Framework

PauseAI Global is the sole Data Controller (GDPR) for all data in the CRM, across all chapters. Local chapters operate as volunteers/processors under Global's umbrella. This means there is no legal "data transfer" between workspaces — it all belongs to Global. However, we still enforce operational isolation between chapters: access is scoped by workspace, and email consent is managed independently per workspace.

## Core Concepts

### Workspaces

A workspace represents an operational unit — either PauseAI Global or a national chapter. There are exactly two types:

- **global**: Exactly one exists. Has special privileges (aggregate reporting, cross-workspace segments). This is PauseAI Global.
- **chapter**: One per national chapter. Operationally independent. Cannot see other chapters' data by default.

This is a flat hierarchy. There is no nesting (no sub-chapters). If a chapter needs internal subdivisions, they use tags within their workspace.

Each workspace has a default language.

### Contacts

A contact is a person. They exist once in the system, identified by their `id`. Email is the preferred deduplication key but is nullable (some contacts are added before we have their email — e.g., politicians, people met at events). A partial unique constraint ensures no two contacts share the same non-null email.

Contacts have a small set of **structural fields** — hardcoded columns on the `contacts` table that the application logic depends on:

- `email`
- `first_name`
- `last_name`
- `language`
- `globally_unsubscribed` (boolean — the nuclear unsubscribe option)
- `created_by_workspace_id` (audit trail: which workspace first added this person)

These fields cannot be renamed, deleted, or retyped by an admin. They always appear in the UI.

### Contact–Workspace Relationship (The Junction)

A contact is visible to a workspace if and only if a row exists in the `contact_workspaces` junction table linking them. No row means the workspace cannot see the contact (with one exception: Global admins can query the raw `contacts` table for aggregate reporting).

The junction table also holds the workspace-level master subscription switch: `subscribed`, `unsubscribed`, or `neutral`. This acts as an override — if set to `unsubscribed`, the contact receives nothing from that workspace regardless of category-level preferences.

### Custom Fields

All non-structural fields are admin-defined and stored in a generic key-value structure (`custom_field_definitions` + `custom_field_values`).

Custom fields have three scopes:

| Scope | Defined by | Visible to | Example |
|-------|-----------|------------|---------|
| `core` | Global admin | All workspaces | "Contact Type", "Organization", "Source" |
| `global_internal` | Global admin | Global workspace only | "Donor Tier", "Board Relationship" |
| `workspace` | Workspace admin | That workspace only | PAIF's "Département", UK's "Constituency" |

When a user views the contacts table, they see: structural fields (always) + core fields + fields scoped to their active workspace. They never see another workspace's local fields or `global_internal` fields (unless they're in the Global workspace).

### Communication Categories

Communication categories (newsletter, campaign alerts, event invites, etc.) are workspace-scoped. Each workspace defines its own categories. A contact's preferences are tracked per category.

The email permission hierarchy, from most authoritative to least:

1. **`contacts.globally_unsubscribed`** — if true, contact receives nothing from anyone. Full stop.
2. **`contact_workspaces.subscription_status`** — if "unsubscribed" for a given workspace, contact receives nothing from that workspace.
3. **`contact_communication_preferences`** — per-category preference within a workspace. Contact must be explicitly "subscribed" to a category to receive emails in that category (conservative default: "neutral" does not receive).

### Connections (External Syncing)

Each connection (external database sync) targets a specific workspace. When a sync pulls in contacts:

- If the contact (matched by email) doesn't exist in `contacts`, create them and create a `contact_workspaces` row for the target workspace.
- If the contact exists but has no `contact_workspaces` row for this workspace, create the junction row.
- If the contact exists and already has a junction row, update according to the field mapping.

The connection configuration must include a `workspace_id` field specifying the target workspace.

### Email Connections (Personal Email Integration)

Email connections (Gmail integration) are **user-scoped**, not workspace-scoped. This is intentionally different from data sync connections (Airtable, Notion) which are workspace-scoped.

- Each user owns their email connection — it is tied to their user account, not a workspace
- The connection persists across workspace switches
- When a user imports Gmail contacts, they are added to the **currently active workspace**
- Synced email interactions are associated with the user's email connection, not a workspace directly
- Visibility of synced interactions follows user-scoped rules: the owner always sees their own synced emails; other users only see interactions marked `visible_to_team = true`

This design reflects the fact that a user's email inbox is personal, while the contacts and interactions they choose to share belong to whichever workspace they import into.

## User Experience Flows

### Workspace Switcher

Users who belong to multiple workspaces see a workspace switcher in the navigation. The active workspace determines what they see everywhere: contacts, segments, campaigns, custom fields, communication categories, API keys, scripts.

Most users belong to one workspace and never see the switcher.

### Viewing Contacts

When a user opens the contacts list:

- The table shows contacts linked to their active workspace (via `contact_workspaces`).
- Columns shown: structural fields + core custom fields + active workspace's custom fields.
- Global admins can switch to an "All Chapters" aggregate view that shows all contacts across all workspaces, read-only for contacts not linked to the Global workspace.

### Adding a Contact

When a user adds a contact:

1. They enter details (email, name, etc.).
2. If email is provided, the system checks for an existing contact with that email.
3. **If found:** The system notifies the user that this person already exists in the PauseAI network and offers to add them to the current workspace. If confirmed, a `contact_workspaces` row is created with `subscription_status = "neutral"`. No data from other workspaces is revealed beyond the fact that the person exists.
4. **If not found:** A new `contacts` row and `contact_workspaces` row are created.

### Sending a Campaign

A campaign belongs to a workspace and a communication category. When sending:

1. Resolve the segment to a list of contact IDs.
2. Filter: contact must have a `contact_workspaces` row for this workspace.
3. Filter: `globally_unsubscribed` must be false.
4. Filter: `contact_workspaces.subscription_status` must not be "unsubscribed."
5. Filter: contact must be "subscribed" for this campaign's communication category.
6. Send.

### Unsubscribe Page

When a contact clicks an unsubscribe link (which encodes `contact_id` and `workspace_id`, HMAC-signed):

- The preference center shows a section for each workspace that has ever emailed them.
- Within each section: toggles for each of that workspace's communication categories.
- A "Unsubscribe from [workspace name]" button (sets the workspace master switch).
- A "Unsubscribe from all PauseAI communications" button at the bottom (sets `globally_unsubscribed`).

### Building Segments

Segments are workspace-scoped by default. A PAIF segment only queries contacts linked to PAIF.

Global workspace can create **cross-workspace segments** (a flag on the segment). These query across all `contact_workspaces` rows. Only the Global workspace can create cross-workspace segments. Cross-workspace segments are read-only / reporting tools — they cannot be used as campaign targets (since a campaign must belong to a single workspace, and contacts must be subscribed to that specific workspace).

### Scripts / Automations

Scripts are workspace-scoped. When a script executes, it can only access contacts linked to its workspace. Global workspace scripts can access all contacts.

## User Roles & Permissions

There are two layers of roles:

**Global role** (on the `users` table): `admin`, `member`, `viewer`. This is the user's system-wide role.

**Workspace role** (on `user_workspaces`): `admin`, `member`, `viewer`. This is the user's role within a specific workspace.

A user's effective permissions within a workspace are the **maximum** of their global role and their workspace role. A global admin can do anything in any workspace. A workspace admin can manage their workspace but not others.

**Workspace admins can:**

- Manage contacts within their workspace (add, edit, remove from workspace)
- Define workspace-scoped custom fields
- Define workspace communication categories
- Create and send campaigns
- Create segments and scripts
- Invite users to their workspace

**Only Global admins can:**

- Create and delete workspaces
- Define `core` and `global_internal` custom fields
- Create cross-workspace segments
- View aggregate / all-chapters data
- Manage global user roles

## Migration Path

To avoid any broken intermediate state:

1. Create the new schema (`workspaces` table, `contact_workspaces` junction, updated custom fields, workspace-scoped communication categories, `user_workspaces`).
2. Create a single "PauseAI Global" workspace with `type = "global"`.
3. Migrate all existing contacts to have a `contact_workspaces` row linking to the Global workspace. Preserve existing subscription statuses.
4. Migrate all existing communication categories to belong to the Global workspace.
5. Migrate existing contact communication preferences to reference the new workspace-scoped categories.
6. Migrate all existing custom field definitions to `scope = "core"` (or `global_internal` as appropriate), with `workspace_id = NULL`.
7. Migrate all existing users to have a `user_workspaces` row for the Global workspace with their current role.
8. Migrate existing connections to target the Global workspace.
9. Migrate existing segments and campaigns to belong to the Global workspace.
10. Add workspace context to all API routes. Initially, the active workspace can be inferred (there's only one), so existing behavior is preserved.
11. Build the workspace switcher UI.
12. Create the first chapter workspace (Pause IA France) and test the full flow: adding contacts, creating workspace-specific custom fields, defining communication categories, sending a campaign, unsubscribe flow.

## What This Document Does NOT Cover

- **Implementation details:** Schema DDL, API route changes, component modifications — the implementing agent will determine these based on the existing codebase.
- **Merge duplicates feature:** Needed eventually for contacts without email, but not part of this build.
- **Workspace-level branding** (logo, sender name in emails): Likely needed but can be added as simple fields on the `workspaces` table later.
- **Billing / per-workspace plans:** Not relevant for PauseAI's model.
- **Workspace deletion:** Edge case to handle later (what happens to contacts, campaigns, etc.).
