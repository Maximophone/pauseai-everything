import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { users } from "./users";

export const interactions = pgTable("interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id), // who logged it
  type: text("type").notNull(), // email, call, meeting, note, form_submission
  subject: text("subject"),
  body: text("body"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
