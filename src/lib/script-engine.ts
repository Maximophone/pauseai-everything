import vm from "node:vm";
import { db } from "@/db";
import { contacts } from "@/db/schema/contacts";
import { interactions } from "@/db/schema/interactions";
import { emails } from "@/db/schema/emails";
import { tags, contactTags } from "@/db/schema/tags";
import { eq, sql } from "drizzle-orm";
import { buildSegmentWhere, getSegmentContactIds, getSegment } from "./segments";
import { sendEmail, resolveFromEmail } from "./mailersend";
import {
  getScript,
  createScriptRun,
  updateScriptRun,
  updateScript,
} from "./scripts";
import type { SegmentCondition } from "@/db/schema/segments";

const TIMEOUT_MS = 30_000; // 30 seconds
const MAX_CONTACTS = 1000;
const MAX_EMAILS_PER_RUN = 100;

type ScriptResult = {
  status: "success" | "error";
  log: string;
  error?: string;
  contactsAffected: number;
};

// ─── Build the ctx SDK ────────────────────────────────────

function buildContext(logs: string[], counters: { emails: number; affected: Set<string> }, workspaceId?: string | null) {
  // Workspace-scoped contact query helper
  const wsJoin = workspaceId
    ? sql`INNER JOIN contact_workspaces cw ON cw.contact_id = contacts.id AND cw.workspace_id = ${workspaceId}`
    : sql``;

  const ctx = {
    // ─── contacts ───────────────────────────────────
    contacts: {
      find: async (filter: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> => {
        const conditions: SegmentCondition[] = [];

        for (const [key, value] of Object.entries(filter)) {
          if (key === "tag" || key === "has_tag") {
            conditions.push({ field: "tag", operator: "has", value: String(value) });
          } else if (key === "not_tag" || key === "not_has_tag") {
            conditions.push({ field: "tag", operator: "not_has", value: String(value) });
          } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            // Handle operator objects: { country: { neq: "US" } }
            const ops = value as Record<string, unknown>;
            for (const [op, val] of Object.entries(ops)) {
              conditions.push({ field: key, operator: op, value: val });
            }
          } else {
            conditions.push({ field: key, operator: "eq", value });
          }
        }

        if (conditions.length === 0) {
          const query = workspaceId
            ? sql`SELECT contacts.* FROM contacts ${wsJoin} LIMIT ${MAX_CONTACTS}`
            : sql`SELECT * FROM contacts LIMIT ${MAX_CONTACTS}`;
          const rows = (await db.execute(query)) as unknown as Record<string, unknown>[];
          return rows.map(normalizeRow);
        }

        const where = buildSegmentWhere({ match: "all", conditions }, workspaceId ?? undefined);
        const query = where
          ? sql`SELECT contacts.* FROM contacts ${wsJoin} WHERE ${where} LIMIT ${MAX_CONTACTS}`
          : sql`SELECT contacts.* FROM contacts ${wsJoin} LIMIT ${MAX_CONTACTS}`;

        const rows = (await db.execute(query)) as unknown as Record<string, unknown>[];
        return rows.map(normalizeRow);
      },

      update: async (id: string, fields: Record<string, unknown>) => {
        const coreFields: Record<string, unknown> = {};
        const customFields: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(fields)) {
          if (["email", "firstName", "first_name", "lastName", "last_name"].includes(key)) {
            const col = key === "firstName" ? "first_name" :
                        key === "lastName" ? "last_name" : key;
            coreFields[col] = value;
          } else {
            customFields[key] = value;
          }
        }

        // Update core fields if any
        if (Object.keys(coreFields).length > 0) {
          const setClauses = Object.entries(coreFields)
            .map(([k, v]) => sql`${sql.raw(k)} = ${String(v)}`);
          await db.execute(sql`
            UPDATE contacts
            SET ${sql.join(setClauses, sql`, `)}, updated_at = NOW()
            WHERE id = ${id}
          `);
        }

        // Update custom fields if any
        for (const [key, value] of Object.entries(customFields)) {
          await db.execute(sql`
            UPDATE contacts
            SET custom_fields = jsonb_set(
              COALESCE(custom_fields, '{}'::jsonb),
              ${`{${key}}`}::text[],
              ${JSON.stringify(value)}::jsonb
            ),
            updated_at = NOW()
            WHERE id = ${id}
          `);
        }

        counters.affected.add(id);
      },

      create: async (fields: { email: string; firstName?: string; lastName?: string; [key: string]: unknown }) => {
        const { email, firstName, lastName, first_name, last_name, ...custom } = fields;
        const [contact] = await db
          .insert(contacts)
          .values({
            email,
            firstName: firstName || (first_name as string) || null,
            lastName: lastName || (last_name as string) || null,
            customFields: custom,
          })
          .returning();
        counters.affected.add(contact.id);
        return contactToPlain(contact);
      },
    },

    // ─── tags ───────────────────────────────────────
    tags: {
      add: async (contactId: string, tagName: string) => {
        // Find or create tag (workspace-scoped)
        const tagCondition = workspaceId
          ? sql`${tags.name} = ${tagName} AND ${tags.workspaceId} = ${workspaceId}`
          : sql`${tags.name} = ${tagName}`;
        let [tag] = await db.select().from(tags).where(tagCondition);
        if (!tag) {
          [tag] = await db.insert(tags).values({ name: tagName, ...(workspaceId ? { workspaceId } : {}) }).returning();
        }
        await db
          .insert(contactTags)
          .values({ contactId, tagId: tag.id })
          .onConflictDoNothing();
        counters.affected.add(contactId);
      },

      remove: async (contactId: string, tagName: string) => {
        const [tag] = await db.select().from(tags).where(eq(tags.name, tagName));
        if (tag) {
          await db
            .delete(contactTags)
            .where(
              sql`${contactTags.contactId} = ${contactId} AND ${contactTags.tagId} = ${tag.id}`
            );
          counters.affected.add(contactId);
        }
      },

      list: async (contactId: string): Promise<string[]> => {
        const result = await db
          .select({ name: tags.name })
          .from(contactTags)
          .innerJoin(tags, eq(contactTags.tagId, tags.id))
          .where(eq(contactTags.contactId, contactId));
        return result.map((r) => r.name);
      },
    },

    // ─── email ──────────────────────────────────────
    email: {
      send: async (params: { to: string; subject: string; html: string; fromName?: string; fromEmail?: string }) => {
        if (counters.emails >= MAX_EMAILS_PER_RUN) {
          throw new Error(`Email rate limit reached (max ${MAX_EMAILS_PER_RUN} per script run)`);
        }

        const result = await sendEmail({
          to: [{ email: params.to }],
          from: {
            email: params.fromEmail || await resolveFromEmail() || "noreply@pauseai.info",
            name: params.fromName || "PauseAI",
          },
          subject: params.subject,
          html: params.html,
        });

        // Log in emails table
        await db.insert(emails).values({
          toAddress: params.to,
          fromAddress: params.fromEmail || await resolveFromEmail() || "noreply@pauseai.info",
          direction: "outbound",
          subject: params.subject,
          body: params.html,
          status: result.ok ? "sent" : "failed",
          mailersendId: result.messageId || null,
          metadata: { source: "script" },
        });

        counters.emails++;
        return { ok: result.ok, error: result.error };
      },
    },

    // ─── interactions ───────────────────────────────
    interactions: {
      create: async (contactId: string, type: string, notes?: string) => {
        await db.insert(interactions).values({
          contactId,
          type,
          body: notes || null,
          metadata: { source: "script" },
        });
        counters.affected.add(contactId);
      },
    },

    // ─── segments ───────────────────────────────────
    segments: {
      query: async (segmentId: string): Promise<Record<string, unknown>[]> => {
        const segment = await getSegment(segmentId);
        if (!segment) throw new Error(`Segment "${segmentId}" not found`);

        const ids = await getSegmentContactIds(segment.filter);
        if (ids.length === 0) return [];

        const limitedIds = ids.slice(0, MAX_CONTACTS);
        const placeholders = limitedIds.map((id) => sql`${id}`);
        const rows = (await db.execute(
          sql`SELECT * FROM contacts WHERE id IN (${sql.join(placeholders, sql`, `)})`
        )) as unknown as Record<string, unknown>[];
        return rows.map(normalizeRow);
      },
    },

    // ─── logging ────────────────────────────────────
    log: (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    },
  };

  return ctx;
}

// ─── Execute a script ─────────────────────────────────────

export async function executeScript(
  scriptId: string,
  triggeredBy: "manual" | "cron"
): Promise<ScriptResult> {
  const script = await getScript(scriptId);
  if (!script) {
    return { status: "error", log: "", error: "Script not found", contactsAffected: 0 };
  }

  // Create a run record
  const run = await createScriptRun({
    scriptId,
    status: "running",
    triggeredBy,
  });

  const logs: string[] = [];
  const counters = { emails: 0, affected: new Set<string>() };

  try {
    const ctx = buildContext(logs, counters, script.workspaceId);

    // Wrap user code in an async IIFE so await works
    const wrappedCode = `(async () => { ${script.code} })()`;

    // Create a restricted sandbox — only ctx, Date, Math, JSON, console
    const sandbox = {
      ctx,
      console: {
        log: ctx.log,
        warn: ctx.log,
        error: ctx.log,
        info: ctx.log,
      },
      Date,
      Math,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      RegExp,
      Map,
      Set,
      Promise,
      setTimeout: undefined,
      setInterval: undefined,
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
    };

    const context = vm.createContext(sandbox);
    const vmScript = new vm.Script(wrappedCode, {
      filename: `script-${script.name}.js`,
    });

    // Execute with timeout
    await vmScript.runInContext(context, { timeout: TIMEOUT_MS });

    const logText = logs.join("\n");
    const affected = counters.affected.size;

    // Update run record
    await updateScriptRun(run.id, {
      status: "success",
      log: logText,
      contactsAffected: String(affected),
      completedAt: new Date(),
    });

    // Update script last run info
    await updateScript(scriptId, {
      lastRunAt: new Date(),
      lastRunStatus: "success",
    });

    return { status: "success", log: logText, contactsAffected: affected };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);
    const logText = logs.join("\n");

    await updateScriptRun(run.id, {
      status: "error",
      log: logText,
      error: errorMsg,
      contactsAffected: String(counters.affected.size),
      completedAt: new Date(),
    });

    await updateScript(scriptId, {
      lastRunAt: new Date(),
      lastRunStatus: "error",
    });

    return {
      status: "error",
      log: logText,
      error: errorMsg,
      contactsAffected: counters.affected.size,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────

function contactToPlain(c: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    ...c.customFields,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const custom = (row.custom_fields || {}) as Record<string, unknown>;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    name: [row.first_name, row.last_name].filter(Boolean).join(" "),
    ...custom,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
