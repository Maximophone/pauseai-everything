import { listFieldDefinitions } from "@/lib/contacts";
import { listSegments } from "@/lib/segments";
import { SegmentBuilder } from "@/components/segment-builder";
import { getServerWorkspaceId, isServerWorkspaceGlobal } from "@/lib/workspace-server";

export default async function SegmentsPage() {
  const workspaceId = await getServerWorkspaceId();
  const isGlobal = await isServerWorkspaceGlobal();
  const [fieldDefinitions, segments] = await Promise.all([
    listFieldDefinitions(workspaceId, isGlobal),
    listSegments(workspaceId),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Segments</h2>
      <p className="text-muted-foreground mt-1">
        Build audience segments by filtering contacts on any field, tag, or date.
      </p>
      <div className="mt-6">
        <SegmentBuilder
          fieldDefinitions={JSON.parse(JSON.stringify(fieldDefinitions))}
          initialSegments={JSON.parse(JSON.stringify(segments))}
        />
      </div>
    </div>
  );
}
