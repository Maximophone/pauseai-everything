import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const scripts = pgTable("scripts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  code: text("code").notNull().default(""),
  cronSchedule: text("cron_schedule"), // null = manual only, e.g. "0 6 * * *"
  enabled: boolean("enabled").default(true).notNull(),
  workspaceId: uuid("workspace_id"), // FK to workspaces(id)
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"), // "success" | "error"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scriptRuns = pgTable("script_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  scriptId: uuid("script_id")
    .notNull()
    .references(() => scripts.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // "running" | "success" | "error"
  log: text("log"),
  error: text("error"),
  contactsAffected: text("contacts_affected"), // number as string
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  triggeredBy: text("triggered_by"), // "manual" | "cron"
});

export type Script = typeof scripts.$inferSelect;
export type ScriptRun = typeof scriptRuns.$inferSelect;
