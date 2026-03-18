import type { Task } from "graphile-worker";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { interactions } from "@/db/schema/interactions";
import { sql, eq } from "drizzle-orm";

const DORMANT_DAYS = 60;

export const detectChurnTask: Task = async (_payload, helpers) => {
  helpers.logger.info("Running churn detection...");

  // Find contacts whose lifecycle_stage is "active" or "highly_active"
  // but have no interactions in the last DORMANT_DAYS days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DORMANT_DAYS);

  const dormantContacts = await db.execute(sql`
    SELECT c.id, c.email, c.first_name, c.custom_fields->>'lifecycle_stage' as stage
    FROM contacts c
    WHERE (c.custom_fields->>'lifecycle_stage') IN ('active', 'highly_active')
    AND NOT EXISTS (
      SELECT 1 FROM interactions i
      WHERE i.contact_id = c.id
      AND i.occurred_at > ${cutoffDate.toISOString()}
    )
  `) as unknown as Array<{ id: string; email: string; first_name: string; stage: string }>;

  if (dormantContacts.length === 0) {
    helpers.logger.info("No dormant contacts found.");
    return;
  }

  helpers.logger.info(`Found ${dormantContacts.length} dormant contacts.`);

  // Update their lifecycle_stage to "dormant"
  for (const contact of dormantContacts) {
    await db.execute(sql`
      UPDATE contacts
      SET custom_fields = jsonb_set(custom_fields, '{lifecycle_stage}', '"dormant"'),
          updated_at = NOW()
      WHERE id = ${contact.id}
    `);

    // Log the stage change as an interaction
    await db.execute(sql`
      INSERT INTO interactions (id, contact_id, type, subject, notes, occurred_at, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${contact.id},
        'stage_change',
        'Moved to Dormant (auto)',
        ${'No interactions in the last ' + DORMANT_DAYS + ' days. Previous stage: ' + contact.stage},
        NOW(),
        NOW(),
        NOW()
      )
    `);
  }

  helpers.logger.info(`Updated ${dormantContacts.length} contacts to dormant.`);
};
