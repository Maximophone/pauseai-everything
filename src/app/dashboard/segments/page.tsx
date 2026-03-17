import { listFieldDefinitions } from "@/lib/contacts";
import { listSegments } from "@/lib/segments";
import { SegmentBuilder } from "@/components/segment-builder";

export default async function SegmentsPage() {
  const [fieldDefinitions, segments] = await Promise.all([
    listFieldDefinitions(),
    listSegments(),
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
