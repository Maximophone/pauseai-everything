import { listTags } from "@/lib/tags";
import { TagsManager } from "@/components/tags-manager";
import { getServerWorkspaceId } from "@/lib/workspace-server";

export default async function TagsPage() {
  const workspaceId = await getServerWorkspaceId();
  const tags = await listTags(workspaceId);

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
        <p className="text-muted-foreground mt-1">
          Create and manage tags for organizing contacts.
        </p>
      </div>
      <div className="mt-6">
        <TagsManager initialTags={JSON.parse(JSON.stringify(tags))} />
      </div>
    </div>
  );
}
