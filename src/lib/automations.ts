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
import { eq, asc, sql } from "drizzle-orm";
import { buildSegmentWhere } from "./segments";

// ─── CRUD ──────────────────────────────────────────────────

export async function listAutomationRules() {
  return db.select().from(automationRules).orderBy(asc(automationRules.name));
}

export async function getAutomationRule(id: string) {
  const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id));
  return rule ?? null;
}

export async function createAutomationRule(data: {
  name: string;
  description?: string;
  config: AutomationRuleConfig;
}) {
  const [rule] = await db.insert(automationRules).values(data).returning();
  return rule;
}

export async function updateAutomationRule(
  id: string,
  data: Partial<{ name: string; description: string; config: AutomationRuleConfig; isActive: boolean }>
) {
  const [updated] = await db
    .update(automationRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(automationRules.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteAutomationRule(id: string) {
  const result = await db
    .delete(automationRules)
    .where(eq(automationRules.id, id))
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

  // Use segment query engine to find matching contacts
  const where = buildSegmentWhere({
    match: config.match,
    conditions: config.conditions,
  });

  const query = where
    ? sql`SELECT id FROM contacts WHERE ${where}`
    : sql`SELECT id FROM contacts`;

  const matchingContacts = (await db.execute(query)) as unknown as Array<{ id: string }>;

  if (matchingContacts.length === 0) return 0;

  let affected = 0;
  for (const { id: contactId } of matchingContacts) {
    const changed = await applyActions(contactId, config.actions);
    if (changed) affected++;
  }

  // Update last run timestamp
  await db
    .update(automationRules)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(automationRules.id, rule.id));

  return affected;
}

async function applyActions(contactId: string, actions: RuleAction[]): Promise<boolean> {
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
        // Find or create the tag
        let [tag] = await db
          .select()
          .from(tags)
          .where(eq(tags.name, action.tag));

        if (!tag) {
          [tag] = await db
            .insert(tags)
            .values({ name: action.tag })
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
        const [tag] = await db
          .select()
          .from(tags)
          .where(eq(tags.name, action.tag));

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
