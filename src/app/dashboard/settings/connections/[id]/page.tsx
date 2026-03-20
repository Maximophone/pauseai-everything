import { ConnectionDetail } from "@/components/connection-detail";

export default async function ConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <ConnectionDetail connectionId={id} />
    </div>
  );
}
