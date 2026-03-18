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
  EyeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
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
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type CampaignEmail = {
  id: string;
  contactId: string | null;
  toAddress: string | null;
  subject: string | null;
  status: string | null;
  createdAt: string;
  contactFirstName: string | null;
  contactLastName: string | null;
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <ClockIcon className="h-4 w-4 text-muted-foreground" />,
  scheduled: <CalendarIcon className="h-4 w-4 text-blue-500" />,
  sending: <MailIcon className="h-4 w-4 text-blue-500 animate-pulse" />,
  sent: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
  failed: <AlertCircleIcon className="h-4 w-4 text-destructive" />,
};

const emailStatusColors: Record<string, string> = {
  sent: "text-blue-600 bg-blue-50",
  delivered: "text-green-600 bg-green-50",
  opened: "text-emerald-600 bg-emerald-50",
  clicked: "text-purple-600 bg-purple-50",
  bounced: "text-red-600 bg-red-50",
  failed: "text-red-600 bg-red-50",
  complained: "text-orange-600 bg-orange-50",
};

function CampaignDetail({
  campaign,
  segments,
}: {
  campaign: Campaign;
  segments: Segment[];
}) {
  const [emailList, setEmailList] = useState<CampaignEmail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewEmail, setPreviewEmail] = useState("");
  const [sendingPreview, setSendingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  async function loadEmails() {
    if (emailList !== null) {
      setEmailList(null);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/emails`);
    if (res.ok) {
      setEmailList(await res.json());
    }
    setLoading(false);
  }

  async function handleSendPreview() {
    if (!previewEmail.trim()) return;
    setSendingPreview(true);
    setPreviewResult(null);

    const res = await fetch(`/api/campaigns/${campaign.id}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: previewEmail.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setPreviewResult(data.ok ? "Preview sent!" : data.error || "Send failed.");
    } else {
      const text = await res.text();
      try {
        setPreviewResult(JSON.parse(text).error || "Send failed.");
      } catch {
        setPreviewResult(`Failed (${res.status}).`);
      }
    }
    setSendingPreview(false);
  }

  const segName = segments.find((s) => s.id === campaign.segmentId)?.name;

  return (
    <div className="mt-2 pl-7 space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground max-w-lg">
        <div>Audience: <span className="text-foreground">{segName || "All contacts"}</span></div>
        <div>Status: <span className="text-foreground capitalize">{campaign.status}</span></div>
        {campaign.scheduledAt && (
          <div>Scheduled: <span className="text-foreground">{new Date(campaign.scheduledAt).toLocaleString()}</span></div>
        )}
        {campaign.sentAt && (
          <div>Sent: <span className="text-foreground">{new Date(campaign.sentAt).toLocaleString()}</span></div>
        )}
        {campaign.status === "sent" && (
          <>
            <div>Sent: <span className="text-foreground">{campaign.sentCount}</span></div>
            <div>Bounced: <span className="text-foreground">{campaign.bouncedCount}</span></div>
          </>
        )}
      </div>

      <div className="text-xs">
        <span className="text-muted-foreground">Subject:</span>{" "}
        <span className="font-mono">{campaign.subject}</span>
      </div>

      {/* Send preview */}
      {campaign.status === "draft" && (
        <div className="flex items-center gap-2">
          <Input
            value={previewEmail}
            onChange={(e) => setPreviewEmail(e.target.value)}
            placeholder="Send preview to email..."
            className="w-56 h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendPreview}
            disabled={sendingPreview || !previewEmail.trim()}
            className="h-8 text-xs"
          >
            <EyeIcon className="mr-1 h-3 w-3" />
            {sendingPreview ? "Sending..." : "Send Preview"}
          </Button>
          {previewResult && (
            <span className="text-xs text-muted-foreground">{previewResult}</span>
          )}
        </div>
      )}

      {/* Recipients list */}
      {campaign.status === "sent" && (
        <div>
          <Button variant="ghost" size="sm" onClick={loadEmails} className="text-xs h-7">
            {emailList !== null ? (
              <ChevronUpIcon className="mr-1 h-3 w-3" />
            ) : (
              <ChevronDownIcon className="mr-1 h-3 w-3" />
            )}
            {loading ? "Loading..." : emailList !== null ? "Hide recipients" : "Show recipients"}
          </Button>

          {emailList !== null && emailList.length > 0 && (
            <div className="mt-2 rounded border divide-y max-h-64 overflow-y-auto">
              {emailList.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between px-3 py-1.5 text-xs"
                >
                  <div>
                    <span className="font-medium">
                      {email.contactFirstName} {email.contactLastName}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {email.toAddress}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      emailStatusColors[email.status || ""] || "text-muted-foreground bg-muted"
                    }`}
                  >
                    {email.status || "unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {emailList !== null && emailList.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">No emails found for this campaign.</p>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState("PauseAI");
  const [fromEmail, setFromEmail] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
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
    setScheduledAt("");
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
        scheduledAt: scheduledAt || null,
      }),
    });

    if (res.ok) {
      resetForm();
      await refetch();
    } else {
      const text = await res.text();
      try {
        setError(JSON.parse(text).error || "Failed to create campaign.");
      } catch {
        setError(`Failed (${res.status}).`);
      }
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
      if (result.queued) {
        alert("Campaign queued for sending.");
      } else {
        alert(
          `Campaign sent! ${result.sentCount} emails sent, ${result.bouncedCount} failed.`
        );
      }
      await refetch();
    } else {
      const text = await res.text();
      try {
        setError(JSON.parse(text).error || "Send failed.");
      } catch {
        setError(`Send failed (${res.status}).`);
      }
    }
    setSending(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
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

          <div className="grid grid-cols-2 gap-3">
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
                Schedule (optional)
              </label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                Leave empty to send manually
              </p>
            </div>
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
            <div key={campaign.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-3 text-left flex-1"
                  onClick={() =>
                    setExpandedId(expandedId === campaign.id ? null : campaign.id)
                  }
                >
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
                    {campaign.scheduledAt && campaign.status === "draft" && (
                      <div className="text-xs text-blue-600 mt-0.5">
                        <CalendarIcon className="inline h-3 w-3 mr-1" />
                        Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1">
                  {campaign.status === "draft" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSend(campaign.id)}
                      disabled={sending === campaign.id}
                      title="Send campaign now"
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

              {/* Expanded detail */}
              {expandedId === campaign.id && (
                <CampaignDetail campaign={campaign} segments={segments} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
