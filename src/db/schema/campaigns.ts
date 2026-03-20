import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { segments } from "./segments";
import { communicationCategories } from "./communication-categories";

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML or plain text
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  segmentId: uuid("segment_id").references(() => segments.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => communicationCategories.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft, sending, sent, failed
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  bouncedCount: integer("bounced_count").default(0),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
