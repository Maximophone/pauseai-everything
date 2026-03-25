# Future Features & Ideas

Captured during workspace model review (2026-03-25). These are out of scope for the current workspaces implementation.

## Data Audit & Safety

- **Soft deletes**: Never actually delete data, just flag as "removed". Only superadmin can hard-delete.
- **Audit table**: Record every modification to all tables for traceability and rollback.
- **Snapshots**: Regular snapshots of the entire system with ability to restore. Snapshots should be versioned to handle data model changes.
- **Superadmin role**: A role above admin that can take destructive actions (hard delete, workspace deletion, etc.). Workspace deletion should probably be soft-delete only.

## MailerSend Test Mode

- Dev mode that disconnects from real MailerSend and instead logs/displays API requests.
- Minimal dev UI showing what emails would be sent.
- Ability to simulate MailerSend webhook calls for testing.
- Goal: isolate MailerSend API problems from internal problems.

## UI Improvements

- **Contact table auto-refresh**: After creating a new contact, the table should update instantly without requiring a page refresh.
- **Tag selector in segments**: The segment filter UI uses a plain text field for tags. Should use the same tag picker component as the contacts table.
- **Tag selector in connection field mapper**: Same issue as segments.
- **Connections navigation**: Connections should have their own top-level tab in the sidebar, not be nested under Settings.

## API Keys Workspace Scoping

- API keys should be scoped to a specific workspace by default.
- A key assigned to the France workspace should never affect Global data.
- Global workspace keys should also be locked to Global by default (not cross-workspace).
- Option to create a "superkey" that can manipulate all data, but not the default.
