import { SyncConfigWizard } from "@/components/sync-config-wizard";

export default async function NewSyncPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <SyncConfigWizard connectionId={id} />
    </div>
  );
}
