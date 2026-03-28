# Contacts

Contacts are the core of the CRM. Every person in your network — volunteers, allies, politicians, journalists — is a contact.

## Browsing contacts

The **All Contacts** page shows a table of all contacts in your current workspace. You can:

- **Search** by name, email, or any field using the search bar
- **Sort** by clicking column headers
- **Filter** using the filter bar above the table
- **Edit inline** by clicking a cell directly in the table
- **Select multiple** contacts using checkboxes for bulk actions (tag, delete, export)

The table supports large datasets (tens of thousands of contacts) with server-side pagination.

## Contact detail

Click a contact's name to open their detail page. Here you'll find:

- **All fields** — editable form with all standard and custom fields
- **Tags** — add or remove tags
- **Interaction timeline** — a chronological log of all touchpoints (emails, meetings, calls, notes, stage changes)
- **Subscription status** — which email categories this contact is subscribed to
- **Sync info** — if the contact was imported from an external connection, you'll see the source and last sync time

### Logging interactions

On the contact detail page, click **Log Interaction** to record a touchpoint:

- **Type**: email, phone, meeting, event, note, other
- **Notes**: free-text description
- **Date**: defaults to now, can be backdated

Some interactions are logged automatically (e.g., when an email campaign is sent).

## Importing contacts

Go to **Contacts → Import** to bulk-import contacts from a CSV file.

1. Upload your CSV file
2. Map CSV columns to contact fields (name, email, country, etc.)
3. Preview the import — see how many contacts will be created vs. updated
4. Confirm the import

Duplicate detection is based on email address. If a contact with the same email already exists, their fields will be updated rather than creating a duplicate.

### Importing from Gmail

You can also import contacts from your personal Gmail account. Go to **My Email Contacts** in the sidebar, connect your Gmail account, and browse everyone you have emailed. Select contacts and click "Add to Workspace" to import them. See the [My Email Contacts](my-email-contacts.md) guide for details.

## Tags

Tags are simple labels you attach to contacts for flexible categorization. Examples: "volunteer", "board-member", "media-contact", "event-attendee-2026".

### Managing tags

Go to **Contacts → Tags** to see all tags in your workspace. From here you can:

- **Create** a new tag (name + optional color)
- **Rename** or **delete** existing tags
- See how many contacts have each tag

### Tagging contacts

You can tag contacts in several ways:

- **From the contact detail page** — use the tags section to add/remove
- **In bulk from the table** — select multiple contacts, then use the "Add Tag" action
- **During import** — map a CSV column to tags

## Segments

Segments are saved filters that define a group of contacts. They're used to target email campaigns and get a quick count of contacts matching certain criteria.

### Building a segment

Go to **Contacts → Segments** and click **New Segment**:

1. Give it a name (e.g., "Active volunteers in France")
2. Add conditions using the query builder:
   - Field conditions: `country equals France`, `lifecycle_stage is Active`
   - Tag conditions: `has tag "volunteer"`
   - Date conditions: `created after 2025-01-01`
3. Combine with AND/OR logic
4. Preview the matching contacts and count
5. Save

### Using segments

Once saved, segments are available when creating email campaigns — you select which segment to send to. The segment is evaluated at send time, so it always reflects the current state of your contacts.
