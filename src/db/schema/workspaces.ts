import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { users, userRoleEnum } from "./users";

// ---------- enums ----------

export const workspaceTypeEnum = pgEnum("workspace_type", [
  "global",
  "chapter",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "subscribed",
  "unsubscribed",
  "neutral",
]);

export const fieldScopeEnum = pgEnum("field_scope", [
  "core",
  "global_internal",
  "workspace",
]);

// ---------- workspaces ----------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: workspaceTypeEnum("type").notNull(),
  defaultLanguage: text("default_language").default("en").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

// ---------- contact_workspaces (junction) ----------

export const contactWorkspaces = pgTable(
  "contact_workspaces",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .default("neutral")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.workspaceId] }),
  ]
);

export type ContactWorkspace = typeof contactWorkspaces.$inferSelect;
export type NewContactWorkspace = typeof contactWorkspaces.$inferInsert;

// ---------- user_workspaces (junction) ----------

export const userWorkspaces = pgTable(
  "user_workspaces",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").default("viewer").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.workspaceId] }),
  ]
);

export type UserWorkspace = typeof userWorkspaces.$inferSelect;
export type NewUserWorkspace = typeof userWorkspaces.$inferInsert;
