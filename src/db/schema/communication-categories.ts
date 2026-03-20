import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

export const communicationCategories = pgTable("communication_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(), // slug, e.g. "newsletter"
  label: text("label").notNull(), // display name, e.g. "Newsletter"
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CommunicationCategory = typeof communicationCategories.$inferSelect;
export type NewCommunicationCategory = typeof communicationCategories.$inferInsert;
