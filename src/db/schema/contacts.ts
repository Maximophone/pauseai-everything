import { pgTable, uuid, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    language: text("language"),
    globallyUnsubscribed: boolean("globally_unsubscribed").default(false).notNull(),
    createdByWorkspaceId: uuid("created_by_workspace_id"), // FK to workspaces(id), set on creation
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    communicationPreferences: jsonb("communication_preferences")
      .$type<Record<string, "subscribed" | "unsubscribed">>()
      .default({})
      .notNull(),
    // Sync provenance — set when a contact is created or updated via a sync
    syncConfigurationId: uuid("sync_configuration_id"), // FK to sync_configurations(id), SET NULL on delete
    syncedFields: jsonb("synced_fields").$type<string[]>(), // CRM target names locked by the sync
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_contacts_custom_fields").using("gin", table.customFields),
  ]
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
