import { listFieldDefinitions } from "@/lib/contacts";
import { FieldsManager } from "@/components/fields-manager";

export default async function FieldDefinitionsPage() {
  const fields = await listFieldDefinitions();

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
        />
      </div>
    </div>
  );
}
