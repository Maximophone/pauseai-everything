import { ConnectionsManager } from "@/components/connections-manager";

export default function ConnectionsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Connections</h2>
      <p className="text-muted-foreground mt-1">
        Connect external systems like Airtable, Notion, and others to
        automatically sync contacts into your CRM.
      </p>
      <div className="mt-6">
        <ConnectionsManager />
      </div>
    </div>
  );
}
