import { listFieldDefinitions } from "@/lib/contacts";
import { FieldsManager } from "@/components/fields-manager";
import { getServerWorkspaceId, isServerWorkspaceGlobal } from "@/lib/workspace-server";

export default async function FieldDefinitionsPage() {
  const workspaceId = await getServerWorkspaceId();
  const isGlobal = await isServerWorkspaceGlobal();
  const fields = await listFieldDefinitions(workspaceId, isGlobal);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Field Definitions</h2>
      <p className="text-muted-foreground mt-1">
        Manage custom fields for contacts. Changes here affect the contact form,
        CSV import, and table columns.
      </p>
      <div className="mt-6">
        <FieldsManager
          initialFields={JSON.parse(JSON.stringify(fields))}
          isGlobalWorkspace={isGlobal}
        />
      </div>
    </div>
  );
}
