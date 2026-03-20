"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  Trash2Icon,
  CheckCircleIcon,
  XCircleIcon,
  CircleDashedIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
} from "lucide-react";

type Connection = {
  id: string;
  name: string;
  connectorType: string;
  status: string;
  statusMessage: string | null;
  lastTestedAt: string | null;
  createdAt: string;
};

const CONNECTOR_LABELS: Record<string, string> = {
  airtable: "Airtable",
  notion: "Notion",
  google_sheets: "Google Sheets",
  mailchimp: "Mailchimp",
  demo: "Demo (Test Data)",
};

const CONNECTOR_CONFIGS: Record<string, { credentialKey: string; credentialLabel: string; placeholder: string; helpText: string } | null> = {
  airtable: {
    credentialKey: "apiKey",
    credentialLabel: "Personal Access Token",
    placeholder: "pat...",
    helpText: "Create one at airtable.com/create/tokens with read access to the bases you want to sync.",
  },
  notion: {
    credentialKey: "integrationToken",
    credentialLabel: "Integration Token",
    placeholder: "ntn_...",
    helpText: "Create an internal integration at notion.so/my-integrations, then share the databases you want to sync with it.",
  },
  demo: null, // No credentials needed
};

const isDev = process.env.NODE_ENV === "development";

const AVAILABLE_CONNECTORS = isDev
  ? ["airtable", "notion", "demo"]
  : ["airtable", "notion"];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          <CheckCircleIcon className="h-3 w-3" /> Connected
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
          <XCircleIcon className="h-3 w-3" /> Error
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
          <CircleDashedIcon className="h-3 w-3" /> Untested
        </span>
      );
  }
}

export function ConnectionsManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("airtable");
  const [newCredentialValue, setNewCredentialValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  async function fetchConnections() {
    const res = await fetch("/api/connections");
    if (res.ok) {
      setConnections(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchConnections();
  }, []);

  const connectorConfig = CONNECTOR_CONFIGS[newType];
  const needsCredentials = connectorConfig !== null;

  async function createConnection() {
    if (!newName.trim()) return;
    if (needsCredentials && !newCredentialValue.trim()) return;
    setCreating(true);
    setCreateError(null);

    const credentials: Record<string, unknown> = needsCredentials
      ? { [connectorConfig!.credentialKey]: newCredentialValue.trim() }
      : {};

    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        connectorType: newType,
        credentials,
      }),
    });

    if (res.ok) {
      const conn = await res.json();
      setNewName("");
      setNewCredentialValue("");
      setShowCreate(false);
      await fetchConnections();
      // Auto-test
      await testConnection(conn.id);
    } else {
      const err = await res.json();
      setCreateError(err.error || "Failed to create connection");
    }
    setCreating(false);
  }

  async function testConnection(id: string) {
    setTesting(id);
    await fetch(`/api/connections/${id}/test`, { method: "POST" });
    await fetchConnections();
    setTesting(null);
  }

  async function deleteConnection(id: string) {
    if (!confirm("Delete this connection and all its sync configurations?"))
      return;
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConnections(connections.filter((c) => c.id !== id));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Create form */}
      {showCreate ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-medium">New Connection</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Airtable - Volunteers"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={newType}
                onChange={(e) => { setNewType(e.target.value); setNewCredentialValue(""); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                {AVAILABLE_CONNECTORS.map((type) => (
                  <option key={type} value={type}>
                    {CONNECTOR_LABELS[type] || type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {needsCredentials && (
            <div>
              <label className="text-xs text-muted-foreground">
                {connectorConfig!.credentialLabel}
              </label>
              <Input
                type="password"
                value={newCredentialValue}
                onChange={(e) => setNewCredentialValue(e.target.value)}
                placeholder={connectorConfig!.placeholder}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {connectorConfig!.helpText}
              </p>
            </div>
          )}
          {!needsCredentials && (
            <p className="text-xs text-muted-foreground">
              No credentials needed. This connector uses sample data for testing.
            </p>
          )}
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={createConnection} disabled={creating || !newName.trim() || (needsCredentials && !newCredentialValue.trim())}>
              {creating ? "Creating..." : "Create & Test"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      )}

      {/* Connection list */}
      {connections.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No connections yet. Add one to start syncing contacts from external
          systems.
        </p>
      )}

      {connections.length > 0 && (
        <div className="divide-y rounded-lg border">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{conn.name}</span>
                  <StatusBadge status={conn.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {CONNECTOR_LABELS[conn.connectorType] || conn.connectorType}
                  {conn.statusMessage && conn.status === "error" && (
                    <span className="text-red-500 ml-2">
                      {conn.statusMessage}
                    </span>
                  )}
                  {conn.lastTestedAt && (
                    <>
                      {" · "}
                      Tested {new Date(conn.lastTestedAt).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => testConnection(conn.id)}
                  disabled={testing === conn.id}
                  title="Test connection"
                >
                  <RefreshCwIcon
                    className={`h-4 w-4 ${testing === conn.id ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    window.location.href = `/dashboard/settings/connections/${conn.id}`;
                  }}
                  title="View syncs"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteConnection(conn.id)}
                  title="Delete connection"
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
