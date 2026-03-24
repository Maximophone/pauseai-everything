import { pgTable, uuid, text, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    color: text("color"),
    workspaceId: uuid("workspace_id"), // FK to workspaces(id)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_tags_name_workspace").on(table.name, table.workspaceId),
  ]
);

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.contactId, table.tagId] })]
);
