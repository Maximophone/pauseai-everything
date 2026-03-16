import { pgTable, uuid, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const fieldDefinitions = pgTable("field_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(), // text, number, date, select, multiselect, boolean, url
  options: jsonb("options").$type<string[]>(), // for select/multiselect
  required: boolean("required").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
