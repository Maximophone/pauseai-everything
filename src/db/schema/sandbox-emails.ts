import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";
import { workspaces } from "./workspaces";

export const sandboxEmails = pgTable("sandbox_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: text("message_id").notNull().unique(),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  headers: jsonb("headers").$type<Record<string, string>>().default({}),
  templateParams: jsonb("template_params").$type<Record<string, unknown>>(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  status: text("status").notNull().default("sent"),
  statusHistory: jsonb("status_history")
    .$type<Array<{ event: string; timestamp: string; url?: string }>>()
    .default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SandboxEmail = typeof sandboxEmails.$inferSelect;
export type NewSandboxEmail = typeof sandboxEmails.$inferInsert;
