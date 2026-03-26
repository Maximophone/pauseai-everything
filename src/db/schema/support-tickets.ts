import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const ticketTypeEnum = pgEnum("ticket_type", ["bug", "feature"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
]);

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: ticketTypeEnum("type").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  priority: ticketPriorityEnum("priority").default("medium").notNull(),
  upvoteCount: integer("upvote_count").default(0).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;

export const ticketReplies = pgTable("ticket_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  isAdminReply: boolean("is_admin_reply").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TicketReply = typeof ticketReplies.$inferSelect;
export type NewTicketReply = typeof ticketReplies.$inferInsert;

export const ticketUpvotes = pgTable(
  "ticket_upvotes",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.ticketId, table.userId] })]
);

export type TicketUpvote = typeof ticketUpvotes.$inferSelect;

export const ticketSubscriptions = pgTable(
  "ticket_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.ticketId, table.userId)]
);

export type TicketSubscription = typeof ticketSubscriptions.$inferSelect;
