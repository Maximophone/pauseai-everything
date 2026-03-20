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
  PencilIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";

type Segment = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
  label: string;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
  segmentId: string | null;
  categoryId: string | null;
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

type Recipient = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  unsubscribed?: boolean;
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
  categories,
  onUpdated,
}: {
  campaign: Campaign;
  segments: Segment[];
  categories: Category[];
  onUpdated: () => void;
}) {
  const [emailList, setEmailList] = useState<CampaignEmail[] | null>(null);
  const [recipientList, setRecipientList] = useState<{ count: number; activeCount: number; unsubscribedCount: number; recipients: Recipient[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [previewEmail, setPreviewEmail] = useState("");
  const [sendingPreview, setSendingPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(campaign.name);
  const [editSubject, setEditSubject] = useState(campaign.subject);
  const [editBody, setEditBody] = useState(campaign.body);
  const [editFromName, setEditFromName] = useState(campaign.fromName || "PauseAI");
  const [editFromEmail, setEditFromEmail] = useState(campaign.fromEmail || "");
  const [editSegmentId, setEditSegmentId] = useState(campaign.segmentId || "");
  const [editCategoryId, setEditCategoryId] = useState(campaign.categoryId || "");
  const [editScheduledAt, setEditScheduledAt] = useState(
    campaign.scheduledAt ? campaign.scheduledAt.slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEditing() {
    setEditName(campaign.name);
    setEditSubject(campaign.subject);
    setEditBody(campaign.body);
    setEditFromName(campaign.fromName || "PauseAI");
    setEditFromEmail(campaign.fromEmail || "");
    setEditSegmentId(campaign.segmentId || "");
    setEditCategoryId(campaign.categoryId || "");
    setEditScheduledAt(campaign.scheduledAt ? campaign.scheduledAt.slice(0, 16) : "");
    setEditError(null);
    setEditing(true);
  }

  async function saveEdits() {
    if (!editName.trim() || !editSubject.trim() || !editBody.trim()) return;
    setSaving(true);
    setEditError(null);

    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        subject: editSubject.trim(),
        body: editBody.trim(),
        fromName: editFromName.trim() || null,
        fromEmail: editFromEmail.trim() || null,
        segmentId: editSegmentId || null,
        categoryId: editCategoryId || null,
        scheduledAt: editScheduledAt || null,
      }),
    });

    if (res.ok) {
      setEditing(false);
      onUpdated();
    } else {
      const text = await res.text();
      try {
        setEditError(JSON.parse(text).error || "Save failed.");
      } catch {
        setEditError(`Save failed (${res.status}).`);
      }
    }
    setSaving(false);
  }

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

  async function loadRecipients() {
    if (recipientList !== null) {
      setRecipientList(null);
      return;
    }
    setLoadingRecipients(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/recipients`);
    if (res.ok) {
      setRecipientList(await res.json());
    }
    setLoadingRecipients(false);
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
  const catLabel = categories.find((c) => c.id === campaign.categoryId)?.label;

  // ─── Edit form ──────────────────────────────────
  if (editing) {
    return (
      <div className="mt-2 pl-7 space-y-3 text-sm">
        {editError && (
          <div className="rounded-md bg-destructive/10 text-destructive px-3 py-1.5 text-xs">
            {editError}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">From Name</label>
            <Input
              value={editFromName}
              onChange={(e) => setEditFromName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">From Email</label>
            <Input
              value={editFromEmail}
              onChange={(e) => setEditFromEmail(e.target.value)}
              placeholder="leave empty for default"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Audience (Segment)</label>
            <select
              value={editSegmentId}
              onChange={(e) => setEditSegmentId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All contacts</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Schedule (optional)</label>
            <Input
              type="datetime-local"
              value={editScheduledAt}
              onChange={(e) => setEditScheduledAt(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Email Category</label>
          <select
            value={editCategoryId}
            onChange={(e) => setEditCategoryId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">None (transactional — no unsubscribe)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-0.5">
            Categorized emails include an unsubscribe link and respect contact preferences.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Subject</label>
          <Input
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            Use {"{{fieldName}}"} for merge fields
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Body (HTML)</label>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={8}
            className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            Use <code className="bg-muted px-1 rounded">{"{{unsubscribe}}"}</code> for an unsubscribe link, e.g.{" "}
            <code className="bg-muted px-1 rounded">{'<a href="{{unsubscribe}}">Unsubscribe</a>'}</code>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={saveEdits}
            disabled={saving || !editName.trim() || !editSubject.trim() || !editBody.trim()}
          >
            <SaveIcon className="mr-1 h-3 w-3" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <XIcon className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ─── Read-only detail view ──────────────────────
  return (
    <div className="mt-2 pl-7 space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground max-w-lg">
        <div>Audience: <span className="text-foreground">{segName || "All contacts"}</span></div>
        <div>Category: <span className="text-foreground">{catLabel || "Transactional"}</span></div>
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
            <div>Delivered: <span className="text-foreground">{campaign.deliveredCount}</span></div>
            <div>Opened: <span className="text-foreground">{campaign.openedCount}</span></div>
            <div>Clicked: <span className="text-foreground">{campaign.clickedCount}</span></div>
            <div>Bounced: <span className="text-foreground">{campaign.bouncedCount}</span></div>
            {(campaign.deliveredCount ?? 0) > 0 && (
              <div>Open Rate: <span className="text-foreground">{(((campaign.openedCount ?? 0) / (campaign.deliveredCount ?? 1)) * 100).toFixed(1)}%</span></div>
            )}
          </>
        )}
      </div>

      <div className="text-xs">
        <span className="text-muted-foreground">Subject:</span>{" "}
        <span className="font-mono">{campaign.subject}</span>
      </div>

      {/* Edit + Send preview + Recipients for drafts */}
      {campaign.status === "draft" && (
        <div className="space-y-2">
          <Button size="sm" variant="outline" onClick={startEditing} className="h-8 text-xs">
            <PencilIcon className="mr-1 h-3 w-3" />
            Edit Campaign
          </Button>

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

          {/* Recipient preview for draft */}
          <div>
            <Button variant="ghost" size="sm" onClick={loadRecipients} className="text-xs h-7">
              {recipientList !== null ? (
                <ChevronUpIcon className="mr-1 h-3 w-3" />
              ) : (
                <ChevronDownIcon className="mr-1 h-3 w-3" />
              )}
              {loadingRecipients ? "Loading..." : recipientList !== null ? "Hide recipients" : "Show recipients"}
              {recipientList !== null && (
                <span className="ml-1 text-muted-foreground">
                  ({recipientList.activeCount} active{recipientList.unsubscribedCount > 0 && (
                    <>, {recipientList.unsubscribedCount} unsubscribed</>
                  )})
                </span>
              )}
            </Button>

            {recipientList !== null && recipientList.recipients.length > 0 && (
              <div className="mt-2 rounded border divide-y max-h-64 overflow-y-auto">
                {recipientList.recipients.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between px-3 py-1.5 text-xs ${
                      r.unsubscribed ? "opacity-60" : ""
                    }`}
                  >
                    <div>
                      <span className="font-medium">
                        {[r.firstName, r.lastName].filter(Boolean).join(" ") || "Unnamed"}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {r.email || "No email"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {r.unsubscribed && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50">
                          Unsubscribed
                        </span>
                      )}
                      {!r.email && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50">
                          No email
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recipientList !== null && recipientList.recipients.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No matching contacts in this segment.</p>
            )}
          </div>
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
  categories,
}: {
  initialCampaigns: Campaign[];
  segments: Segment[];
  categories: Category[];
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
  const [categoryId, setCategoryId] = useState("");
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
    setCategoryId("");
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
        categoryId: categoryId || null,
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
              Email Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None (transactional — no unsubscribe)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-0.5">
              Categorized emails include an unsubscribe link and respect contact preferences.
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">{"{{unsubscribe}}"}</code> to insert an unsubscribe link, e.g.{" "}
              <code className="bg-muted px-1 rounded">{'<a href="{{unsubscribe}}">Unsubscribe</a>'}</code>
            </p>
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
                        Sent: {campaign.sentCount} · Delivered: {campaign.deliveredCount} · Opened: {campaign.openedCount} · Clicked: {campaign.clickedCount}
                        {(campaign.bouncedCount ?? 0) > 0 && <> · Bounced: {campaign.bouncedCount}</>}
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
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSend(campaign.id)}
                        disabled={sending === campaign.id}
                        title="Send campaign now"
                      >
                        <SendIcon className="h-4 w-4" />
                      </Button>
                    </>
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
                <CampaignDetail campaign={campaign} segments={segments} categories={categories} onUpdated={refetch} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
