import { listScripts } from "@/lib/scripts";
import { ScriptsManager } from "@/components/scripts-manager";
import { getServerWorkspaceId } from "@/lib/workspace-server";

export default async function AutomationsPage() {
  const workspaceId = await getServerWorkspaceId();
  const scripts = await listScripts(workspaceId);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Automations</h2>
      <p className="text-muted-foreground mt-1">
        Write JavaScript scripts to automate contact management. Scripts can run
        on a schedule or on demand.
      </p>
      <div className="mt-6">
        <ScriptsManager
          initialScripts={JSON.parse(JSON.stringify(scripts))}
        />
      </div>
    </div>
  );
}
