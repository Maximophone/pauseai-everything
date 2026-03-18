import type { Task } from "graphile-worker";
import { runAllActiveRules } from "@/lib/automations";

export const runAutomationsTask: Task = async (_payload, helpers) => {
  helpers.logger.info("Running automation rules...");

  const results = await runAllActiveRules();

  for (const { rule, affected } of results) {
    if (affected > 0) {
      helpers.logger.info(`Rule "${rule}": ${affected} contacts affected`);
    }
  }

  const total = results.reduce((sum, r) => sum + r.affected, 0);
  helpers.logger.info(
    `Automations complete: ${results.length} rules, ${total} contacts affected`
  );
};
