# Connections & Sync

Connections let you pull contacts from external systems (Airtable, Notion, etc.) into your workspace automatically. This is an admin feature.

## Setting up a connection

Go to **Connections** in the sidebar and click **New Connection**:

1. **Choose a connector** — Airtable or Notion (more coming)
2. **Enter credentials** — API token or integration key
3. **Test the connection** — verifies that the credentials work

## Sync configurations

Once a connection is established, you create **sync configurations** to define what data flows in.

### Creating a sync

From the connection detail page, click **New Sync**:

1. **Pick a resource** — choose which table/database to sync from (e.g., an Airtable table or Notion database)
2. **Map fields** — for each contact field in the CRM, choose which external field maps to it. You can also set constant values (e.g., always set `source` to "Airtable Import")
3. **Duplicate strategy** — what to do when a contact with the same email already exists (update, skip, or create duplicate)
4. **Schedule** — optional cron expression for automatic syncing

### How sync works

When a sync runs:

1. Records are fetched from the external system
2. Each record is matched by email address
3. New contacts are created; existing ones are updated (based on your duplicate strategy)
4. A sync run record is created with statistics: fetched, created, updated, skipped, errored

### Provenance tracking

Contacts imported via sync show:

- A **"Synced"** badge in the contacts table
- An **attribution banner** on the contact detail page showing which connection and sync brought them in
- **Read-only synced fields** — fields that came from the external system can't be edited manually (they'd be overwritten on next sync)

### Repairing syncs

If the external schema changes (e.g., a column is renamed in Airtable), the sync moves to a **"needs repair"** state. Go to the connection detail page and click **Repair** to re-map the fields.

## Supported connectors

| Connector | Auth method | Features |
|-----------|------------|----------|
| **Airtable** | Personal Access Token | Full table sync, cursor-based pagination, schema introspection |
| **Notion** | Integration Token | Database query, property mapping |
