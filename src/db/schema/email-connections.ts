import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";
import { contacts } from "./contacts";

// ---------- email_connections ----------
// One per user's connected personal email account (Gmail, future: Outlook)

export const emailConnections = pgTable(
  "email_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("gmail"), // "gmail", future: "outlook"
    providerAccountEmail: text("provider_account_email").notNull(),
    accessToken: text("access_token"), // encrypted
    refreshToken: text("refresh_token").notNull(), // encrypted
    tokenExpiresAt: timestamp("token_expires_at"),
    defaultSyncInteractions: boolean("default_sync_interactions")
      .notNull()
      .default(true),
    defaultInteractionsVisible: boolean("default_interactions_visible")
      .notNull()
      .default(true),
    lastSyncedAt: timestamp("last_synced_at"),
    syncIntervalMinutes: text("sync_interval_minutes").notNull().default("5"),
    status: text("status").notNull().default("connected"), // "connected" | "error" | "disconnected"
    statusMessage: text("status_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_connections_user_provider_email_idx").on(
      table.userId,
      table.provider,
      table.providerAccountEmail
    ),
  ]
);

// ---------- email_contact_settings ----------
// Per-user per-contact settings for interaction sync from personal email

export const emailContactSettings = pgTable(
  "email_contact_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailConnectionId: uuid("email_connection_id")
      .notNull()
      .references(() => emailConnections.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    syncInteractions: boolean("sync_interactions").notNull().default(true),
    interactionsVisible: boolean("interactions_visible").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_contact_settings_connection_contact_idx").on(
      table.emailConnectionId,
      table.contactId
    ),
  ]
);

export type EmailConnection = typeof emailConnections.$inferSelect;
export type NewEmailConnection = typeof emailConnections.$inferInsert;
export type EmailContactSetting = typeof emailContactSettings.$inferSelect;
export type NewEmailContactSetting = typeof emailContactSettings.$inferInsert;
