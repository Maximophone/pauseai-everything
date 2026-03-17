import { ApiKeysManager } from "@/components/api-keys-manager";

export default function ApiKeysPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
      <p className="text-muted-foreground mt-1">
        Manage API keys for programmatic access. Use these to integrate with
        n8n, scripts, or other systems.
      </p>
      <div className="mt-6">
        <ApiKeysManager />
      </div>
    </div>
  );
}
