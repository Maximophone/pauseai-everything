import { listFieldDefinitions } from "@/lib/contacts";
import { CsvImporter } from "@/components/csv-importer";

export default async function ImportContactsPage() {
  const fields = await listFieldDefinitions();

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Import Contacts</h2>
      <p className="text-muted-foreground mt-1">
        Upload a CSV file to import contacts into the system.
      </p>
      <div className="mt-6">
        <CsvImporter fieldDefinitions={JSON.parse(JSON.stringify(fields))} />
      </div>
    </div>
  );
}
