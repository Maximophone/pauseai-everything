import { listCampaigns } from "@/lib/campaigns";
import { listSegments } from "@/lib/segments";
import { listCategories } from "@/lib/communication-categories";
import { CampaignManager } from "@/components/campaign-manager";
import { getServerWorkspaceId } from "@/lib/workspace-server";

export default async function CampaignsPage() {
  const workspaceId = await getServerWorkspaceId();
  const [campaigns, segments, categories] = await Promise.all([
    listCampaigns(workspaceId),
    listSegments(workspaceId),
    listCategories(workspaceId),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
      <p className="text-muted-foreground mt-1">
        Create and send email campaigns to your segments.
      </p>
      <div className="mt-6">
        <CampaignManager
          initialCampaigns={JSON.parse(JSON.stringify(campaigns))}
          segments={JSON.parse(JSON.stringify(segments))}
          categories={JSON.parse(JSON.stringify(categories))}
        />
      </div>
    </div>
  );
}
