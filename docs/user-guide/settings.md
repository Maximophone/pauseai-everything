# Settings (Administration)

Settings are only accessible to workspace admins. This is where you configure the CRM for your workspace.

## Users

**Settings → Users** shows all members of the current workspace with their roles.

- **Invite users** — add someone by email. They'll be able to sign in via Google OAuth
- **Change roles** — promote or demote users (viewer, member, admin)
- **Remove users** — revoke access to this workspace

Remember: a user's effective role is the higher of their global role and workspace role.

## Custom fields

**Settings → Fields** lets you define what information you track about contacts, beyond the built-in fields (name, email, country, etc.).

### Field types

| Type | Example |
|------|---------|
| **Text** | Notes, organization name |
| **Number** | Age, donation amount |
| **Date** | Birthday, join date |
| **Email** | Secondary email |
| **URL** | LinkedIn profile |
| **Select** | Department (dropdown) |
| **Multi-select** | Skills (multiple choices) |
| **Boolean** | Checkbox (e.g., "Has signed pledge") |

### Field scopes

Fields have a **scope** that determines visibility:

- **Core** — visible in all workspaces (defined by global admin)
- **Global internal** — visible only in the global workspace
- **Workspace** — visible only in the workspace that created it

## Email categories

**Settings → Email Categories** manages the types of emails contacts can subscribe to (e.g., Newsletter, Event Invitations, Action Alerts).

Each campaign must be assigned a category. Contacts who have opted out of a category won't receive campaigns in that category.

## API keys

**Settings → API Keys** lets you create keys for programmatic access to the CRM API.

- Keys use the format `pai_<random>` and are passed via the `Authorization: Bearer` header
- Each key is tied to a user and gets admin-level access
- The full key is shown **once** at creation — store it securely
- You can revoke keys at any time

See the **API Reference** in the Documentation section for all available endpoints.

## Workspaces

**Settings → Workspaces** is only visible to global admins. From here you can:

- **Create** chapter workspaces (name, slug, default language)
- **Edit** workspace settings
- **Delete** workspaces (this does not delete contacts — they remain in the global workspace)

Each workspace operates independently with its own contacts, tags, campaigns, and settings.
