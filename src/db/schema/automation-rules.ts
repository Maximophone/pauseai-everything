import { pgTable, uuid, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * An automation rule condition:
 * { field: "lifecycle_stage", operator: "eq", value: "active" }
 * { field: "country", operator: "eq", value: "NL" }
 * { field: "days_since_last_interaction", operator: "gt", value: 60 }
 *
 * An automation rule action:
 * { type: "set_field", field: "lifecycle_stage", value: "dormant" }
 * { type: "add_tag", tag: "newsletter" }
 * { type: "remove_tag", tag: "new" }
 */
export type RuleCondition = {
  field: string;
  operator: string;
  value: unknown;
};

export type RuleAction =
  | { type: "set_field"; field: string; value: unknown }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string };

export type AutomationRuleConfig = {
  match: "all" | "any";
  conditions: RuleCondition[];
  actions: RuleAction[];
};

export const automationRules = pgTable("automation_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  config: jsonb("config").$type<AutomationRuleConfig>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  workspaceId: uuid("workspace_id"), // FK to workspaces(id)
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AutomationRule = typeof automationRules.$inferSelect;
