import { listCampaigns } from "@/lib/campaigns";
import { listSegments } from "@/lib/segments";
import { CampaignManager } from "@/components/campaign-manager";

export default async function CampaignsPage() {
  const [campaigns, segments] = await Promise.all([
    listCampaigns(),
    listSegments(),
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
        />
      </div>
    </div>
  );
}
