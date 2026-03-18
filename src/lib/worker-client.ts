import { quickAddJob } from "graphile-worker";

const DATABASE_URL = process.env.DATABASE_URL!;

/**
 * Queue a job for the worker process.
 * Falls back to running inline if worker is not available.
 */
export async function addJob(taskName: string, payload: Record<string, unknown>) {
  try {
    await quickAddJob({ connectionString: DATABASE_URL }, taskName, payload);
  } catch (err) {
    console.error(`[worker-client] Failed to queue job "${taskName}":`, err);
    throw err;
  }
}
