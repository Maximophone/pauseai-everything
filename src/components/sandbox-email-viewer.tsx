"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SandboxEmail = {
  id: string;
  messageId: string;
  toEmail: string;
  toName: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyHtml: string;
  headers: Record<string, string>;
  campaignId: string | null;
  workspaceId: string | null;
  status: string;
  statusHistory: Array<{ event: string; timestamp: string; url?: string }>;
  createdAt: string;
  updatedAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  opened: "bg-emerald-100 text-emerald-800",
  clicked: "bg-teal-100 text-teal-800",
  bounced: "bg-red-100 text-red-800",
  complained: "bg-orange-100 text-orange-800",
  failed: "bg-gray-100 text-gray-800",
};

const SIMULATE_EVENTS = ["delivered", "opened", "clicked", "bounced", "complained", "unsubscribed"] as const;

export function SandboxEmailViewer() {
  const [emails, setEmails] = useState<SandboxEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTo, setFilterTo] = useState("");
  const [filterCampaignId, setFilterCampaignId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterTo) params.set("to", filterTo);
    if (filterCampaignId) params.set("campaignId", filterCampaignId);
    params.set("limit", "100");

    const res = await fetch(`/api/sandbox/emails?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails);
      setTotal(data.total);
    }
    setLoading(false);
  }, [filterTo, filterCampaignId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const simulateEvent = async (emailId: string, event: string) => {
    await fetch(`/api/sandbox/emails/${emailId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    fetchEmails();
  };

  const simulateBulk = async (event: string) => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await fetch(`/api/sandbox/emails/${id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
    }
    setSelectedIds(new Set());
    fetchEmails();
  };

  const clearAll = async () => {
    await fetch("/api/sandbox/emails", { method: "DELETE" });
    setSelectedId(null);
    setSelectedIds(new Set());
    fetchEmails();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const selectedEmail = emails.find((e) => e.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground">Recipient</label>
          <Input
            placeholder="Filter by email..."
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-56"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Campaign ID</label>
          <Input
            placeholder="Filter by campaign..."
            value={filterCampaignId}
            onChange={(e) => setFilterCampaignId(e.target.value)}
            className="w-64"
          />
        </div>
        <Button variant="outline" onClick={fetchEmails} disabled={loading}>
          Refresh
        </Button>
        <Button variant="destructive" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex gap-2 items-center text-sm">
          <span className="text-muted-foreground">{selectedIds.size} selected:</span>
          {SIMULATE_EVENTS.map((evt) => (
            <Button key={evt} variant="outline" size="sm" onClick={() => simulateBulk(evt)}>
              {evt}
            </Button>
          ))}
        </div>
      )}

      {/* Stats */}
      <p className="text-sm text-muted-foreground">
        {total} email{total !== 1 ? "s" : ""} captured
      </p>

      {/* Table */}
      <div className="border rounded-md overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={emails.length > 0 && selectedIds.size === emails.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-2 text-left">Recipient</th>
              <th className="p-2 text-left">Subject</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && emails.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No sandbox emails captured yet.
                </td>
              </tr>
            )}
            {emails.map((email) => (
              <tr
                key={email.id}
                className={`border-b hover:bg-muted/30 cursor-pointer ${
                  selectedId === email.id ? "bg-muted/50" : ""
                }`}
                onClick={() => setSelectedId(selectedId === email.id ? null : email.id)}
              >
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(email.id)}
                    onChange={() => toggleSelect(email.id)}
                  />
                </td>
                <td className="p-2 font-mono text-xs">{email.toEmail}</td>
                <td className="p-2 max-w-xs truncate">{email.subject}</td>
                <td className="p-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[email.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {email.status}
                  </span>
                </td>
                <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(email.createdAt).toLocaleString()}
                </td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    {SIMULATE_EVENTS.slice(0, 3).map((evt) => (
                      <Button
                        key={evt}
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => simulateEvent(email.id, evt)}
                      >
                        {evt}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selectedEmail && (
        <div className="border rounded-md p-4 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{selectedEmail.subject}</h3>
              <p className="text-sm text-muted-foreground">
                From: {selectedEmail.fromName ? `${selectedEmail.fromName} <${selectedEmail.fromEmail}>` : selectedEmail.fromEmail}
                {" → "}
                {selectedEmail.toName ? `${selectedEmail.toName} <${selectedEmail.toEmail}>` : selectedEmail.toEmail}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Message ID: <code>{selectedEmail.messageId}</code>
              </p>
              {selectedEmail.campaignId && (
                <p className="text-xs text-muted-foreground">
                  Campaign: <code>{selectedEmail.campaignId}</code>
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {SIMULATE_EVENTS.map((evt) => (
                <Button
                  key={evt}
                  variant="outline"
                  size="sm"
                  onClick={() => simulateEvent(selectedEmail.id, evt)}
                >
                  {evt}
                </Button>
              ))}
            </div>
          </div>

          {/* Status history */}
          {selectedEmail.statusHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Status History</h4>
              <div className="flex gap-2 flex-wrap">
                {selectedEmail.statusHistory.map((h, i) => (
                  <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                    {h.event} — {new Date(h.timestamp).toLocaleTimeString()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Headers */}
          {Object.keys(selectedEmail.headers || {}).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Headers</h4>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(selectedEmail.headers, null, 2)}
              </pre>
            </div>
          )}

          {/* Rendered HTML body */}
          <div>
            <h4 className="text-sm font-medium mb-1">Rendered Email Body</h4>
            <iframe
              srcDoc={selectedEmail.bodyHtml}
              className="w-full h-96 border rounded bg-white"
              sandbox="allow-same-origin"
              title="Email preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
