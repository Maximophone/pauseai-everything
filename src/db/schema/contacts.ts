import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  lifecycleStage: text("lifecycle_stage").default("joined"),
  country: text("country"),
  chapter: text("chapter"),
  contactTypes: jsonb("contact_types").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
