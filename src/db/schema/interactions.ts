import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { users } from "./users";
import { emailConnections } from "./email-connections";

export const interactions = pgTable("interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id), // who logged it
  type: text("type").notNull(), // email_sent, email_received, call, meeting, note, form_submission
  subject: text("subject"),
  body: text("body"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Gmail/email integration fields
  emailConnectionId: uuid("email_connection_id").references(() => emailConnections.id, { onDelete: "set null" }),
  providerMessageId: text("provider_message_id"), // Gmail message ID, for dedup
  visibleToTeam: boolean("visible_to_team").notNull().default(true),
}, (table) => [
  index("idx_interactions_provider_message").on(table.providerMessageId),
]);
