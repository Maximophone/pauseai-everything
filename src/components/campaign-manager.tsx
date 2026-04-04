"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHasRole } from "@/lib/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  ShieldAlertIcon,
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
  subscriptionStatus?: "subscribed" | "not_subscribed" | "unsubscribed";
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

/**
 * Check whether a campaign with a category has a working unsubscribe mechanism.
 * Returns a list of warning strings, or empty array if everything is fine.
 */
async function checkUnsubscribeWarnings(
  categoryId: string | null | undefined,
  body: string
): Promise<string[]> {
  // No category = transactional email, no unsubscribe needed
  if (!categoryId) return [];

  const warnings: string[] = [];
  const bodyHasUnsubscribeVar = body.includes("{{unsubscribe}}");

  // Fetch server-side unsubscribe infrastructure status
  let secretConfigured = true;
  let listUnsubscribeEnabled = false;
  try {
    const res = await fetch("/api/campaigns/unsubscribe-status");
    if (res.ok) {
      const status = await res.json();
      secretConfigured = status.secretConfigured;
      listUnsubscribeEnabled = status.listUnsubscribeEnabled;
    }
  } catch {
    // If we can't reach the endpoint, assume the worst
    secretConfigured = false;
  }

  const hasListUnsubscribeHeader = listUnsubscribeEnabled && secretConfigured;
  const hasBodyUnsubscribeLink = bodyHasUnsubscribeVar && secretConfigured;

  if (hasListUnsubscribeHeader || hasBodyUnsubscribeLink) return [];

  // Build specific warnings
  if (!secretConfigured) {
    warnings.push(
      "The UNSUBSCRIBE_SECRET environment variable is not configured. Unsubscribe links cannot be generated."
    );
  }
  if (!listUnsubscribeEnabled) {
    warnings.push(
      "The List-Unsubscribe header is disabled. This header allows email clients to show a native unsubscribe button. It can be enabled in Settings (requires MailerSend Professional+ plan)."
    );
  }
  if (!bodyHasUnsubscribeVar) {
    warnings.push(
      "The email body does not contain the {{unsubscribe}} merge variable. Recipients will not see an unsubscribe link in the email."
    );
  }

  return warnings;
}

/**
 * Shared warning dialog for missing unsubscribe mechanisms.
 */
function UnsubscribeWarningDialog({
  open,
  warnings,
  onClose,
  onProceed,
}: {
  open: boolean;
  warnings: string[];
  onClose: () => void;
  onProceed: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlertIcon className="h-5 w-5" />
            Missing Unsubscribe Mechanism
          </DialogTitle>
          <DialogDescription>
            This campaign has a communication category but recipients will have <strong>no way to unsubscribe</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
            <p className="text-sm font-medium text-destructive">Issues detected:</p>
            <ul className="text-sm text-destructive/90 list-disc pl-5 space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm space-y-2">
            <p className="font-medium">Why this matters:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                <strong>CAN-SPAM Act</strong> requires commercial emails to include a clear unsubscribe mechanism. Violations can result in penalties of up to $50,000 per email.
              </li>
              <li>
                <strong>GDPR</strong> requires that recipients can withdraw consent at any time. Emails without an unsubscribe option may violate this requirement.
              </li>
              <li>
                Emails without unsubscribe links are more likely to be <strong>flagged as spam</strong>, harming your sender reputation.
              </li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            <strong>Recommended:</strong> Add{" "}
            <code className="bg-muted px-1 rounded text-xs">{'<a href="{{unsubscribe}}">Unsubscribe</a>'}</code>{" "}
            to your email body, or enable the List-Unsubscribe header in Settings.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Go Back & Fix
          </Button>
          <Button variant="destructive" onClick={onProceed}>
            <ShieldAlertIcon className="mr-2 h-4 w-4" />
            Save Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const isAdmin = useHasRole("admin");
  const [emailList, setEmailList] = useState<CampaignEmail[] | null>(null);
  const [recipientList, setRecipientList] = useState<{ count: number; activeCount: number; notSubscribedCount: number; unsubscribedCount: number; recipients: Recipient[] } | null>(null);
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
  const [editUnsubWarnings, setEditUnsubWarnings] = useState<string[]>([]);
  const [showEditUnsubWarning, setShowEditUnsubWarning] = useState(false);

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

  async function saveEdits(allowNoUnsubscribe = false) {
    if (!editName.trim() || !editSubject.trim() || !editBody.trim()) return;

    // Check for missing unsubscribe mechanism before saving
    if (!allowNoUnsubscribe) {
      setSaving(true);
      const warnings = await checkUnsubscribeWarnings(editCategoryId || null, editBody);
      if (warnings.length > 0) {
        setEditUnsubWarnings(warnings);
        setShowEditUnsubWarning(true);
        setSaving(false);
        return;
      }
    }

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
        ...(allowNoUnsubscribe ? { allowNoUnsubscribe: true } : {}),
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
            onClick={() => saveEdits()}
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

        <UnsubscribeWarningDialog
          open={showEditUnsubWarning}
          warnings={editUnsubWarnings}
          onClose={() => setShowEditUnsubWarning(false)}
          onProceed={() => {
            setShowEditUnsubWarning(false);
            saveEdits(true);
          }}
        />
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
          <span title={!isAdmin ? "Admin access required" : undefined}>
            <Button size="sm" variant="outline" onClick={startEditing} className="h-8 text-xs" disabled={!isAdmin}>
              <PencilIcon className="mr-1 h-3 w-3" />
              Edit Campaign
            </Button>
          </span>

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
                  ({recipientList.activeCount} subscribed
                  {recipientList.notSubscribedCount > 0 && (
                    <>, {recipientList.notSubscribedCount} not subscribed</>
                  )}
                  {recipientList.unsubscribedCount > 0 && (
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
                      r.subscriptionStatus !== "subscribed" ? "opacity-60" : ""
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
                      {r.subscriptionStatus === "not_subscribed" && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100">
                          Not subscribed
                        </span>
                      )}
                      {r.subscriptionStatus === "unsubscribed" && (
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
  const isAdmin = useHasRole("admin");
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Unsubscribe warning dialog state (for create flow)
  const [createUnsubWarnings, setCreateUnsubWarnings] = useState<string[]>([]);
  const [showCreateUnsubWarning, setShowCreateUnsubWarning] = useState(false);

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

  async function handleCreateCampaign(allowNoUnsubscribe = false) {
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    // Check for missing unsubscribe mechanism before creating
    if (!allowNoUnsubscribe) {
      setCreating(true);
      const warnings = await checkUnsubscribeWarnings(categoryId || null, body);
      if (warnings.length > 0) {
        setCreateUnsubWarnings(warnings);
        setShowCreateUnsubWarning(true);
        setCreating(false);
        return;
      }
    }

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
        ...(allowNoUnsubscribe ? { allowNoUnsubscribe: true } : {}),
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
        <span title={!isAdmin ? "Admin access required" : undefined}>
          <Button onClick={() => setShowCreate(true)} disabled={!isAdmin}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </span>
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
              onClick={() => handleCreateCampaign()}
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

          <UnsubscribeWarningDialog
            open={showCreateUnsubWarning}
            warnings={createUnsubWarnings}
            onClose={() => setShowCreateUnsubWarning(false)}
            onProceed={() => {
              setShowCreateUnsubWarning(false);
              handleCreateCampaign(true);
            }}
          />
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
                      <span title={!isAdmin ? "Admin access required" : "Send campaign now"}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSend(campaign.id)}
                          disabled={!isAdmin || sending === campaign.id}
                        >
                          <SendIcon className="h-4 w-4" />
                        </Button>
                      </span>
                    </>
                  )}
                  <span title={!isAdmin ? "Admin access required" : "Delete campaign"}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(campaign.id)}
                      disabled={!isAdmin}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </span>
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
