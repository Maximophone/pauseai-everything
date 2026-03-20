import { SyncDetail } from "@/components/sync-detail";

export default async function SyncDetailPage({
  params,
}: {
  params: Promise<{ id: string; syncId: string }>;
}) {
  const { id, syncId } = await params;

  return (
    <div>
      <SyncDetail connectionId={id} syncId={syncId} />
    </div>
  );
}
