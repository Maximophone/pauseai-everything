import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

export const emails = pgTable("emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  direction: text("direction").notNull(), // inbound, outbound
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  subject: text("subject"),
  body: text("body"),
  status: text("status"), // sent, delivered, opened, clicked, bounced, failed
  mailersendId: text("mailersend_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
