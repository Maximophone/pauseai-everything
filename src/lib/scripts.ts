import { db } from "@/db";
import { scripts, scriptRuns, type Script } from "@/db/schema/scripts";
import { eq, asc, desc } from "drizzle-orm";

// ─── Scripts CRUD ──────────────────────────────────────────

export async function listScripts(workspaceId?: string) {
  if (workspaceId) {
    return db
      .select()
      .from(scripts)
      .where(eq(scripts.workspaceId, workspaceId))
      .orderBy(asc(scripts.name));
  }
  return db.select().from(scripts).orderBy(asc(scripts.name));
}

export async function getScript(id: string) {
  const [script] = await db.select().from(scripts).where(eq(scripts.id, id));
  return script ?? null;
}

export async function createScript(data: {
  name: string;
  description?: string;
  code: string;
  cronSchedule?: string | null;
  workspaceId?: string;
}) {
  const [script] = await db.insert(scripts).values(data).returning();
  return script;
}

export async function updateScript(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    code: string;
    cronSchedule: string | null;
    enabled: boolean;
    lastRunAt: Date;
    lastRunStatus: string;
  }>
) {
  const [updated] = await db
    .update(scripts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(scripts.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteScript(id: string) {
  const result = await db
    .delete(scripts)
    .where(eq(scripts.id, id))
    .returning({ id: scripts.id });
  return result.length > 0;
}

// ─── Script Runs ───────────────────────────────────────────

export async function createScriptRun(data: {
  scriptId: string;
  status: string;
  triggeredBy: string;
}) {
  const [run] = await db.insert(scriptRuns).values(data).returning();
  return run;
}

export async function updateScriptRun(
  id: string,
  data: Partial<{
    status: string;
    log: string;
    error: string;
    contactsAffected: string;
    completedAt: Date;
  }>
) {
  const [updated] = await db
    .update(scriptRuns)
    .set(data)
    .where(eq(scriptRuns.id, id))
    .returning();
  return updated ?? null;
}

export async function getScriptRuns(scriptId: string, limit = 20) {
  return db
    .select()
    .from(scriptRuns)
    .where(eq(scriptRuns.scriptId, scriptId))
    .orderBy(desc(scriptRuns.startedAt))
    .limit(limit);
}

export async function getScriptRun(runId: string) {
  const [run] = await db
    .select()
    .from(scriptRuns)
    .where(eq(scriptRuns.id, runId));
  return run ?? null;
}
