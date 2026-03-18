import { listAutomationRules } from "@/lib/automations";
import { listFieldDefinitions } from "@/lib/contacts";
import { AutomationsManager } from "@/components/automations-manager";

export default async function AutomationsPage() {
  const [rules, fieldDefinitions] = await Promise.all([
    listAutomationRules(),
    listFieldDefinitions(),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Automations</h2>
      <p className="text-muted-foreground mt-1">
        Create if/then rules that automatically update contacts. Active rules
        run every hour via the background worker.
      </p>
      <div className="mt-6">
        <AutomationsManager
          initialRules={JSON.parse(JSON.stringify(rules))}
          fieldDefinitions={JSON.parse(JSON.stringify(fieldDefinitions))}
        />
      </div>
    </div>
  );
}
