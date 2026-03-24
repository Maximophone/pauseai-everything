import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const communicationCategories = pgTable(
  "communication_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(), // slug, e.g. "newsletter"
    label: text("label").notNull(), // display name, e.g. "Newsletter"
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    workspaceId: uuid("workspace_id"), // FK to workspaces(id)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_comm_categories_name_workspace").on(
      table.name,
      table.workspaceId
    ),
  ]
);

export type CommunicationCategory = typeof communicationCategories.$inferSelect;
export type NewCommunicationCategory = typeof communicationCategories.$inferInsert;
