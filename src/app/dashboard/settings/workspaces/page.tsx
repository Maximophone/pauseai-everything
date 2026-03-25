import { listWorkspaces } from "@/lib/workspaces";
import { WorkspacesManager } from "@/components/workspaces-manager";
import { auth } from "@/lib/auth";

export default async function WorkspacesPage() {
  const session = await auth();
  // @ts-expect-error - role is added in auth callbacks
  const globalRole = session?.user?.role ?? "viewer";
  const isGlobalAdmin = globalRole === "admin";

  const workspaces = isGlobalAdmin ? await listWorkspaces() : [];

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Workspaces</h2>
      <p className="text-muted-foreground mt-1">
        Create and manage workspaces. Each workspace has its own contacts, tags,
        fields, and team members.
      </p>
      <div className="mt-6">
        <WorkspacesManager
          initialWorkspaces={JSON.parse(JSON.stringify(workspaces))}
          isGlobalAdmin={isGlobalAdmin}
        />
      </div>
    </div>
  );
}
