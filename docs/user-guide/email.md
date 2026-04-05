# Email

The email system lets you send targeted campaigns to segments of your contacts.

## Campaigns

Go to **Email → Campaigns** to see all campaigns in your workspace.

### Creating a campaign

Click **New Campaign** and fill in:

- **Name** — internal label, not shown to recipients (max 200 characters)
- **Subject** — the email subject line (max 998 characters)
- **Body** — the email content (supports HTML, max 500,000 characters). Use merge variables like `{{firstName}}`, `{{lastName}}`, `{{email}}` — values are automatically HTML-escaped for safety
- **Segment** — which contacts to send to
- **Category** — which communication category (newsletter, events, action-alerts). Contacts who have unsubscribed from this category will be excluded
- **Schedule** — send now or schedule for a specific date/time

### Previewing

Before sending, use **Send Preview** to send a test email to any address. This lets you verify formatting, merge variables, and the unsubscribe link.

### Campaign status

Campaigns go through these stages:

| Status | Meaning |
|--------|---------|
| **Draft** | Not yet sent. Can be edited. |
| **Scheduled** | Will be sent at the scheduled time. |
| **Sending** | Currently being dispatched. |
| **Sent** | Delivery complete. |

### Tracking

After a campaign is sent, the detail page shows delivery metrics:

- **Sent** — total emails dispatched
- **Delivered** — confirmed delivery
- **Opened** — recipients who opened the email
- **Clicked** — recipients who clicked a link
- **Bounced** — delivery failures

You can also see individual email records with their status.

## Communication preferences

Contacts can manage their own email subscriptions via an unsubscribe link included in every campaign email. The link takes them to a preference center where they can opt in/out of each communication category.

Admins manage communication categories in **Settings → Email Categories**. Each category (e.g., "Newsletter", "Event Invitations", "Action Alerts") can be toggled on/off per contact.

When sending a campaign, contacts who have opted out of the selected category are automatically excluded from the recipient list.

### Unsubscribe link

Include `{{unsubscribe}}` in your email body to insert a personalized unsubscribe link. This is required for compliance and good practice.
