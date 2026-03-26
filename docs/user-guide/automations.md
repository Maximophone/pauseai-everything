# Automations

Automations let you run scripts and rules that operate on your contacts automatically. This is an admin feature.

## Scripts

Scripts are small JavaScript programs that run in a sandboxed environment with access to your contacts, tags, and email system.

### Creating a script

Go to **Automations** and click **New Script**:

- **Name** — descriptive label
- **Code** — JavaScript using the `ctx` SDK (see below)
- **Schedule** — optional cron expression to run automatically (e.g., `0 9 * * 1` for every Monday at 9am)

### The `ctx` SDK

Scripts have access to a context object with these methods:

```javascript
// Find contacts matching conditions
const contacts = await ctx.contacts.find({ country: "France", lifecycle_stage: "Active" });

// Update a contact
await ctx.contacts.update(contact.id, { lifecycle_stage: "Highly Active" });

// Tag operations
await ctx.tags.add(contact.id, "follow-up-needed");
await ctx.tags.remove(contact.id, "new-joiner");

// Send email
await ctx.email.send(contact.id, {
  subject: "Welcome!",
  body: "Thanks for joining PauseAI."
});

// Log an interaction
await ctx.interactions.create(contact.id, {
  type: "note",
  notes: "Auto-classified as highly active"
});
```

### Running scripts

Scripts can be:

- **Run manually** — click the "Run" button on the script page
- **Run on schedule** — set a cron expression and the system handles the rest
- **View history** — see past runs with status, duration, and any errors

## Automation rules

Automation rules are simpler if/then rules that run on a schedule:

- **Condition**: a set of contact filters (like a segment)
- **Action**: what to do with matching contacts (add tag, change stage, etc.)
- **Schedule**: when to evaluate (cron expression)

Example: "Every Monday, find contacts who haven't had an interaction in 90 days → set lifecycle stage to Dormant."
