import { db } from "@/db";
import {
  automationRules,
  type AutomationRule,
  type AutomationRuleConfig,
  type RuleCondition,
  type RuleAction,
} from "@/db/schema/automation-rules";
import { contacts } from "@/db/schema/contacts";
import { tags, contactTags } from "@/db/schema/tags";
import { eq, and, asc, sql } from "drizzle-orm";
import { buildSegmentWhere } from "./segments";

// ─── CRUD ──────────────────────────────────────────────────

export async function listAutomationRules(workspaceId?: string) {
  if (workspaceId) {
    return db
      .select()
      .from(automationRules)
      .where(eq(automationRules.workspaceId, workspaceId))
      .orderBy(asc(automationRules.name));
  }
  return db.select().from(automationRules).orderBy(asc(automationRules.name));
}

export async function getAutomationRule(id: string, workspaceId?: string) {
  if (workspaceId) {
    const [rule] = await db.select().from(automationRules).where(
      and(eq(automationRules.id, id), eq(automationRules.workspaceId, workspaceId))
    );
    return rule ?? null;
  }
  const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id));
  return rule ?? null;
}

export async function createAutomationRule(data: {
  name: string;
  description?: string;
  config: AutomationRuleConfig;
  workspaceId?: string;
}) {
  const [rule] = await db.insert(automationRules).values(data).returning();
  return rule;
}

export async function updateAutomationRule(
  id: string,
  data: Partial<{ name: string; description: string; config: AutomationRuleConfig; isActive: boolean }>,
  workspaceId?: string
) {
  const condition = workspaceId
    ? and(eq(automationRules.id, id), eq(automationRules.workspaceId, workspaceId))
    : eq(automationRules.id, id);
  const [updated] = await db
    .update(automationRules)
    .set({ ...data, updatedAt: sql`now()` })
    .where(condition)
    .returning();
  return updated ?? null;
}

export async function deleteAutomationRule(id: string, workspaceId?: string) {
  const condition = workspaceId
    ? and(eq(automationRules.id, id), eq(automationRules.workspaceId, workspaceId))
    : eq(automationRules.id, id);
  const result = await db
    .delete(automationRules)
    .where(condition)
    .returning({ id: automationRules.id });
  return result.length > 0;
}

// ─── Rule execution ────────────────────────────────────────

/**
 * Execute a single automation rule against all matching contacts.
 * Returns the number of contacts affected.
 */
export async function executeRule(rule: AutomationRule): Promise<number> {
  const config = rule.config;
  const workspaceId = rule.workspaceId;

  // Use segment query engine to find matching contacts
  const where = buildSegmentWhere({
    match: config.match,
    conditions: config.conditions,
  }, workspaceId ?? undefined);

  // Scope to workspace contacts via contact_workspaces junction
  const wsJoin = workspaceId
    ? sql`INNER JOIN contact_workspaces cw ON cw.contact_id = contacts.id AND cw.workspace_id = ${workspaceId}`
    : sql``;

  const query = where
    ? sql`SELECT contacts.id FROM contacts ${wsJoin} WHERE ${where}`
    : sql`SELECT contacts.id FROM contacts ${wsJoin}`;

  const matchingContacts = (await db.execute(query)) as unknown as Array<{ id: string }>;

  if (matchingContacts.length === 0) return 0;

  let affected = 0;
  for (const { id: contactId } of matchingContacts) {
    const changed = await applyActions(contactId, config.actions, workspaceId);
    if (changed) affected++;
  }

  // Update last run timestamp
  await db
    .update(automationRules)
    .set({ lastRunAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(automationRules.id, rule.id));

  return affected;
}

async function applyActions(contactId: string, actions: RuleAction[], workspaceId?: string | null): Promise<boolean> {
  let changed = false;

  for (const action of actions) {
    switch (action.type) {
      case "set_field": {
        await db.execute(sql`
          UPDATE contacts
          SET custom_fields = jsonb_set(
            COALESCE(custom_fields, '{}'::jsonb),
            ${`{${action.field}}`}::text[],
            ${JSON.stringify(action.value)}::jsonb
          ),
          updated_at = NOW()
          WHERE id = ${contactId}
        `);
        changed = true;
        break;
      }
      case "add_tag": {
        // Find or create the tag (workspace-scoped)
        const tagCondition = workspaceId
          ? and(eq(tags.name, action.tag), eq(tags.workspaceId, workspaceId))
          : eq(tags.name, action.tag);
        let [tag] = await db
          .select()
          .from(tags)
          .where(tagCondition);

        if (!tag) {
          [tag] = await db
            .insert(tags)
            .values({ name: action.tag, ...(workspaceId ? { workspaceId } : {}) })
            .returning();
        }

        // Add tag to contact (ignore if already exists)
        try {
          await db.insert(contactTags).values({
            contactId,
            tagId: tag.id,
          });
          changed = true;
        } catch {
          // Duplicate — already tagged
        }
        break;
      }
      case "remove_tag": {
        const removeTagCondition = workspaceId
          ? and(eq(tags.name, action.tag), eq(tags.workspaceId, workspaceId))
          : eq(tags.name, action.tag);
        const [tag] = await db
          .select()
          .from(tags)
          .where(removeTagCondition);

        if (tag) {
          const result = await db
            .delete(contactTags)
            .where(
              sql`${contactTags.contactId} = ${contactId} AND ${contactTags.tagId} = ${tag.id}`
            )
            .returning({ contactId: contactTags.contactId });
          if (result.length > 0) changed = true;
        }
        break;
      }
    }
  }

  return changed;
}

/**
 * Run all active automation rules. Used by the cron task.
 */
export async function runAllActiveRules(): Promise<{ rule: string; affected: number }[]> {
  const rules = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.isActive, true))
    .orderBy(asc(automationRules.name));

  const results: { rule: string; affected: number }[] = [];

  for (const rule of rules) {
    const affected = await executeRule(rule);
    results.push({ rule: rule.name, affected });
  }

  return results;
}
