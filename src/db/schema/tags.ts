import { pgTable, uuid, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.contactId, table.tagId] })]
);
