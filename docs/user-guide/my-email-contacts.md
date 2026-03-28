# My Email Contacts

The **My Email Contacts** feature lets you connect your personal Gmail account to the CRM. Once connected, you can browse everyone you have emailed, import them as contacts into your workspace, and automatically log email interactions on their timelines.

## Connecting your Gmail account

1. Click **My Email Contacts** in the sidebar
2. Click **Connect Gmail Account**
3. You will be redirected to Google to authorize read-only access to your Gmail (the `gmail.readonly` scope)
4. After granting permission, you will be redirected back to the CRM

Your Gmail connection is tied to your user account, not to a specific workspace. It persists when you switch workspaces.

Only read-only access is requested -- the CRM cannot send, modify, or delete any of your emails.

## Browsing email contacts

Once connected, you will see a table of everyone you have emailed (extracted from your sent messages). Each row shows:

- **Name and email** of the person
- **CRM match status** -- whether they already exist in your current workspace ("In Workspace" badge) or not
- **Sync settings** -- whether interaction syncing is enabled for this contact

Contacts already in your workspace appear at the top of the list.

## Importing contacts to your workspace

To add Gmail contacts to the CRM:

1. Select one or more contacts using the checkboxes
2. Click **Add to Workspace**
3. The contacts are created in your currently active workspace

If a contact with the same email already exists in the CRM, they will be linked to your workspace rather than duplicated.

## Interaction syncing

When syncing is enabled for a contact, the CRM periodically fetches your email exchanges with them and logs them as interactions on the contact's timeline. The sync:

- Runs automatically on a configurable interval (set in connection settings)
- Can be triggered manually with the **Sync Now** button
- Stores only the email subject and a short snippet (the full email body is not stored)
- Creates `email_sent` or `email_received` interaction types based on the message direction
- Deduplicates automatically -- the same email is never logged twice

### Per-contact sync settings

For each contact, you can configure:

- **Sync interactions** (on/off) -- whether to fetch and log emails for this contact
- **Visible to team** (on/off) -- whether other users can see these synced interactions

By default, contacts already in the CRM have syncing enabled. You can adjust settings individually or in bulk.

### Default settings

Click the settings icon on your connection to set defaults for newly imported contacts:

- **Default sync interactions** -- on or off
- **Default visible to team** -- on or off

## Visibility and privacy

Email interactions synced from your Gmail follow these visibility rules:

- **Your own synced emails** are always visible to you on the contact timeline, regardless of the visibility setting
- **Other team members** only see synced interactions where "Visible to team" is turned on
- Gmail-synced interactions display a **Gmail badge** on the timeline
- Private interactions (not visible to team) show a **Private** indicator

This means you can use Gmail sync for your own tracking without exposing all your email correspondence to the rest of the team.

## Disconnecting

To remove your Gmail connection:

1. Go to **My Email Contacts**
2. Click the disconnect button on your connection
3. The OAuth token is revoked with Google and deleted from the CRM
4. Previously synced interactions remain on contact timelines (they are not deleted)

## Requirements

- A Google account with Gmail
- The `EMAIL_ENCRYPTION_KEY` environment variable must be configured by your administrator (this encrypts your OAuth tokens at rest)
- The Gmail API must be enabled in the Google Cloud project used by the CRM
