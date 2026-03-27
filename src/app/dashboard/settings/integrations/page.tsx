import { IntegrationsSettings } from "@/components/settings/integrations-settings";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure third-party service credentials. These values override environment variables.
        </p>
      </div>
      <IntegrationsSettings />
    </div>
  );
}
