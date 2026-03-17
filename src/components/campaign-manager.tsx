"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  SendIcon,
  Trash2Icon,
  MailIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
} from "lucide-react";

type Segment = {
  id: string;
  name: string;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
  segmentId: string | null;
  status: string;
  sentCount: number | null;
  deliveredCount: number | null;
  openedCount: number | null;
  clickedCount: number | null;
  bouncedCount: number | null;
  sentAt: string | null;
  createdAt: string;
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <ClockIcon className="h-4 w-4 text-muted-foreground" />,
  sending: <MailIcon className="h-4 w-4 text-blue-500 animate-pulse" />,
  sent: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
  failed: <AlertCircleIcon className="h-4 w-4 text-destructive" />,
};

export function CampaignManager({
  initialCampaigns,
  segments,
}: {
  initialCampaigns: Campaign[];
  segments: Segment[];
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState("PauseAI");
  const [fromEmail, setFromEmail] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [creating, setCreating] = useState(false);

  async function refetch() {
    const res = await fetch("/api/campaigns");
    if (res.ok) setCampaigns(await res.json());
  }

  function resetForm() {
    setName("");
    setSubject("");
    setBody("");
    setFromName("PauseAI");
    setFromEmail("");
    setSegmentId("");
    setShowCreate(false);
    setError(null);
  }

  async function createCampaign() {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setCreating(true);
    setError(null);

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        fromName: fromName.trim() || null,
        fromEmail: fromEmail.trim() || null,
        segmentId: segmentId || null,
      }),
    });

    if (res.ok) {
      resetForm();
      await refetch();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create campaign.");
    }
    setCreating(false);
  }

  async function handleSend(id: string) {
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return;

    const segName = segments.find((s) => s.id === campaign.segmentId)?.name || "all contacts";
    if (
      !confirm(
        `Send campaign "${campaign.name}" to ${segName}? This cannot be undone.`
      )
    )
      return;

    setSending(id);
    setError(null);

    const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      alert(
        `Campaign sent! ${result.sentCount} emails sent, ${result.bouncedCount} failed.`
      );
      await refetch();
    } else {
      const data = await res.json();
      setError(data.error || "Send failed.");
    }
    setSending(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {!showCreate && (
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border p-4 space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold">New Campaign</h3>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Campaign Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. March Newsletter"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                From Name
              </label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="PauseAI"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                From Email (leave empty for default)
              </label>
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@pauseai.info"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Audience (Segment)
            </label>
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All contacts</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Hi {{firstName}}, March update from PauseAI"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use {"{{fieldName}}"} for merge fields (e.g. {"{{firstName}}"}, {"{{country}}"})
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Body (HTML)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="<p>Hi {{firstName}},</p><p>Here's your monthly update...</p>"
              rows={8}
              className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={createCampaign}
              disabled={
                creating || !name.trim() || !subject.trim() || !body.trim()
              }
              size="sm"
            >
              {creating ? "Creating..." : "Create Campaign"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No campaigns yet. Create one above.
        </p>
      )}

      {campaigns.length > 0 && (
        <div className="divide-y rounded-lg border">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {statusIcons[campaign.status] || statusIcons.draft}
                <div>
                  <div className="text-sm font-medium">{campaign.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {campaign.subject}
                    {campaign.segmentId && (
                      <span className="ml-2">
                        → {segments.find((s) => s.id === campaign.segmentId)?.name || "segment"}
                      </span>
                    )}
                  </div>
                  {campaign.status === "sent" && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Sent: {campaign.sentCount} | Bounced: {campaign.bouncedCount}
                      {campaign.sentAt && (
                        <span className="ml-2">
                          on {new Date(campaign.sentAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {campaign.status === "draft" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSend(campaign.id)}
                    disabled={sending === campaign.id}
                    title="Send campaign"
                  >
                    <SendIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(campaign.id)}
                  title="Delete campaign"
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
