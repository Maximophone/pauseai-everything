export type ScriptTemplate = {
  name: string;
  description: string;
  code: string;
};

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    name: "Blank script",
    description: "Empty script with SDK reference",
    code: `// Available SDK methods:
//
// ctx.contacts.find(filter)    — query contacts (max 1000)
//   Examples: { country: "NL" }, { tag: "leader" }, { lifecycle_stage: { neq: "dormant" } }
// ctx.contacts.update(id, fields)
// ctx.contacts.create({ email, firstName, lastName, ...customFields })
//
// ctx.tags.add(contactId, tagName)
// ctx.tags.remove(contactId, tagName)
// ctx.tags.list(contactId)
//
// ctx.email.send({ to, subject, html })   — max 100 per run
//
// ctx.interactions.create(contactId, type, notes)
//
// ctx.segments.query(segmentId)   — returns contacts matching a saved segment
//
// ctx.log(message)   — appears in run logs

`,
  },
  {
    name: "Flag dormant contacts",
    description: "Tag contacts with no recent interactions as dormant",
    code: `const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

const active = await ctx.contacts.find({
  lifecycle_stage: "active",
});

let flagged = 0;
for (const contact of active) {
  // Check if they have the "dormant" tag already
  const tagList = await ctx.tags.list(contact.id);
  if (tagList.includes("dormant")) continue;

  await ctx.contacts.update(contact.id, { lifecycle_stage: "dormant" });
  await ctx.tags.add(contact.id, "dormant");
  await ctx.interactions.create(contact.id, "note", "Auto-flagged as dormant by script");
  flagged++;
  ctx.log(\`Flagged \${contact.name || contact.email} as dormant\`);
}

ctx.log(\`Done: \${flagged} contacts flagged out of \${active.length} active\`);
`,
  },
  {
    name: "Welcome new contacts",
    description: "Send a welcome email to contacts created in the last 24 hours",
    code: `const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const recent = await ctx.contacts.find({
  created_at: { after: yesterday },
  not_tag: "welcomed",
});

ctx.log(\`Found \${recent.length} new contacts to welcome\`);

for (const contact of recent) {
  await ctx.email.send({
    to: contact.email,
    subject: "Welcome to PauseAI!",
    html: \`<p>Hi \${contact.firstName || "there"},</p>
<p>Thanks for joining PauseAI. We're glad to have you on board!</p>
<p>Best,<br>The PauseAI Team</p>\`,
  });

  await ctx.tags.add(contact.id, "welcomed");
  ctx.log(\`Welcomed \${contact.email}\`);
}

ctx.log(\`Done: sent \${recent.length} welcome emails\`);
`,
  },
  {
    name: "Sync segment to tag",
    description: "Add a tag to all contacts in a saved segment",
    code: `// Replace with your segment ID and tag name
const SEGMENT_ID = "your-segment-id-here";
const TAG_NAME = "segment-member";

const members = await ctx.segments.query(SEGMENT_ID);
ctx.log(\`Segment has \${members.length} contacts\`);

let added = 0;
for (const contact of members) {
  const tagList = await ctx.tags.list(contact.id);
  if (!tagList.includes(TAG_NAME)) {
    await ctx.tags.add(contact.id, TAG_NAME);
    added++;
  }
}

ctx.log(\`Done: added "\${TAG_NAME}" tag to \${added} new contacts\`);
`,
  },
  {
    name: "Bulk update field",
    description: "Update a custom field for contacts matching a condition",
    code: `// Find contacts with a specific condition and update a field
const matching = await ctx.contacts.find({
  country: "Netherlands",
});

ctx.log(\`Found \${matching.length} contacts in the Netherlands\`);

for (const contact of matching) {
  await ctx.contacts.update(contact.id, {
    region: "Europe",
  });
}

ctx.log(\`Done: updated \${matching.length} contacts\`);
`,
  },
];
