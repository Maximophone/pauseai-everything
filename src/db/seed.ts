import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { fieldDefinitions } from "./schema/field-definitions";
import { communicationCategories } from "./schema/communication-categories";
import { workspaces } from "./schema/workspaces";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

const defaultFields = [
  {
    name: "lifecycle_stage",
    label: "Lifecycle Stage",
    fieldType: "select",
    options: ["joined", "onboarding", "active", "highly_active", "dormant", "churned"],
    sortOrder: 1,
  },
  {
    name: "contact_types",
    label: "Contact Types",
    fieldType: "multiselect",
    options: ["member", "politician", "journalist", "coalition_partner", "donor"],
    sortOrder: 2,
  },
  {
    name: "country",
    label: "Country",
    fieldType: "text",
    sortOrder: 3,
  },
  {
    name: "chapter",
    label: "Chapter",
    fieldType: "text",
    sortOrder: 4,
  },
  {
    name: "skills",
    label: "Skills",
    fieldType: "multiselect",
    options: ["policy", "communications", "design", "development", "research", "organizing", "lobbying", "social_media", "writing", "translation"],
    sortOrder: 5,
  },
  {
    name: "hours_committed",
    label: "Hours Committed / Week",
    fieldType: "number",
    sortOrder: 6,
  },
  {
    name: "motivation_level",
    label: "Motivation Level",
    fieldType: "select",
    options: ["low", "medium", "high"],
    sortOrder: 7,
  },
  {
    name: "source",
    label: "Source",
    fieldType: "select",
    options: ["website_join_form", "event", "referral", "social_media", "protest", "manual_entry", "other"],
    sortOrder: 8,
  },
  {
    name: "notes",
    label: "Notes",
    fieldType: "text",
    sortOrder: 9,
  },
  {
    name: "phone",
    label: "Phone",
    fieldType: "text",
    sortOrder: 10,
  },
  {
    name: "discord_handle",
    label: "Discord Handle",
    fieldType: "text",
    sortOrder: 11,
  },
  // Politician-specific fields
  {
    name: "government_level",
    label: "Level of Government",
    fieldType: "select",
    options: ["local", "regional", "national", "eu", "international"],
    sortOrder: 20,
  },
  {
    name: "party",
    label: "Political Party",
    fieldType: "text",
    sortOrder: 21,
  },
  {
    name: "ai_policy_position",
    label: "AI Policy Position",
    fieldType: "select",
    options: ["unknown", "skeptical", "neutral", "cautious", "supportive", "publicly_endorsed"],
    sortOrder: 22,
  },
  {
    name: "relationship_stage",
    label: "Relationship Stage",
    fieldType: "select",
    options: ["cold", "contacted", "met", "warm", "supportive", "publicly_endorsed"],
    sortOrder: 23,
  },
  // Journalist-specific fields
  {
    name: "outlet",
    label: "Media Outlet",
    fieldType: "text",
    sortOrder: 30,
  },
  {
    name: "beat",
    label: "Beat / Focus Area",
    fieldType: "text",
    sortOrder: 31,
  },
  // Donor-specific fields
  {
    name: "total_donated",
    label: "Total Donated",
    fieldType: "number",
    sortOrder: 40,
  },
];

async function seed() {
  // 1. Ensure the Global workspace exists
  console.log("Seeding Global workspace...");
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.type, "global"))
    .limit(1);

  let globalWorkspace;
  if (existing.length > 0) {
    globalWorkspace = existing[0];
    console.log("Global workspace already exists:", globalWorkspace.id);
  } else {
    const [created] = await db
      .insert(workspaces)
      .values({
        name: "PauseAI Global",
        slug: "global",
        type: "global",
        defaultLanguage: "en",
      })
      .returning();
    globalWorkspace = created;
    console.log("Created Global workspace:", globalWorkspace.id);
  }

  // 2. Seed field definitions (scope = "core", no workspace)
  console.log("Seeding field definitions...");
  for (const field of defaultFields) {
    await db
      .insert(fieldDefinitions)
      .values({ ...field, scope: "core", workspaceId: null })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${defaultFields.length} field definitions.`);

  // 3. Seed communication categories (linked to Global workspace)
  const defaultCategories = [
    { name: "newsletter", label: "Newsletter", description: "Regular newsletters and updates", sortOrder: 1 },
    { name: "events", label: "Events", description: "Event invitations and reminders", sortOrder: 2 },
    { name: "action-alerts", label: "Action Alerts", description: "Urgent calls to action", sortOrder: 3 },
  ];

  console.log("Seeding communication categories...");
  for (const cat of defaultCategories) {
    await db
      .insert(communicationCategories)
      .values({ ...cat, workspaceId: globalWorkspace.id })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${defaultCategories.length} communication categories.`);

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
