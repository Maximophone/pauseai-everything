"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  Trash2Icon,
  PlayIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  PauseIcon,
  Loader2Icon,
} from "lucide-react";

type Connection = {
  id: string;
  name: string;
  connectorType: string;
  status: string;
  statusMessage: string | null;
  workspaceId: string | null;
};

type SyncConfig = {
  id: string;
  name: string;
  syncFrequency: string;
  duplicateStrategy: string;
  status: string;
  statusMessage: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
};

function SyncStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          <CheckCircleIcon className="h-3 w-3" /> Active
        </span>
      );
    case "needs_repair":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
          <AlertTriangleIcon className="h-3 w-3" /> Needs Repair
        </span>
      );
    case "paused":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
          <PauseIcon className="h-3 w-3" /> Paused
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
          <XCircleIcon className="h-3 w-3" /> Error
        </span>
      );
    default:
      return null;
  }
}

export function ConnectionDetail({
  connectionId,
}: {
  connectionId: string;
}) {
  const { activeWorkspace } = useWorkspace();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [syncs, setSyncs] = useState<SyncConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSync, setRunningSync] = useState<string | null>(null);

  async function fetchData() {
    const [connRes, syncsRes] = await Promise.all([
      fetch(`/api/connections/${connectionId}`),
      fetch(`/api/connections/${connectionId}/syncs`),
    ]);

    if (connRes.ok) {
      const conn = await connRes.json();
      // Redirect if connection doesn't belong to the active workspace
      if (activeWorkspace && conn.workspaceId && conn.workspaceId !== activeWorkspace.id) {
        window.location.href = "/dashboard/connections";
        return;
      }
      setConnection(conn);
    }
    if (syncsRes.ok) setSyncs(await syncsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [connectionId]);

  async function triggerSync(syncId: string) {
    setRunningSync(syncId);
    await fetch(
      `/api/connections/${connectionId}/syncs/${syncId}/run`,
      { method: "POST" }
    );
    // Wait a moment then refresh to show updated status
    setTimeout(() => {
      fetchData();
      setRunningSync(null);
    }, 2000);
  }

  async function deleteSync(syncId: string) {
    if (!confirm("Delete this sync configuration and all its run history?"))
      return;
    const res = await fetch(
      `/api/connections/${connectionId}/syncs/${syncId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setSyncs(syncs.filter((s) => s.id !== syncId));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!connection) {
    return <p className="text-sm text-red-600">Connection not found.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.location.href = "/dashboard/connections";
          }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {connection.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {connection.connectorType.charAt(0).toUpperCase() +
              connection.connectorType.slice(1)}{" "}
            connection
          </p>
        </div>
      </div>

      {/* Sync configurations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sync Configurations</h3>
          <Button
            size="sm"
            onClick={() => {
              window.location.href = `/dashboard/connections/${connectionId}/syncs/new`;
            }}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Sync
          </Button>
        </div>

        {syncs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No sync configurations yet. Create one to start pulling contacts
            from this connection.
          </p>
        )}

        {syncs.length > 0 && (
          <div className="divide-y rounded-lg border">
            {syncs.map((sync) => (
              <div
                key={sync.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm font-medium hover:underline text-left"
                      onClick={() => {
                        window.location.href = `/dashboard/connections/${connectionId}/syncs/${sync.id}`;
                      }}
                    >
                      {sync.name}
                    </button>
                    <SyncStatusBadge status={sync.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {sync.syncFrequency === "manual"
                      ? "Manual"
                      : sync.syncFrequency.charAt(0).toUpperCase() +
                        sync.syncFrequency.slice(1)}{" "}
                    · {sync.duplicateStrategy === "update" ? "Update duplicates" : "Skip duplicates"}
                    {sync.lastSyncAt && (
                      <>
                        {" · Last sync "}
                        {new Date(sync.lastSyncAt).toLocaleString()}
                        {sync.lastSyncStatus && ` (${sync.lastSyncStatus})`}
                      </>
                    )}
                    {sync.statusMessage && sync.status === "needs_repair" && (
                      <span className="text-amber-600 block mt-0.5">
                        {sync.statusMessage}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {sync.status === "needs_repair" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => {
                        window.location.href = `/dashboard/connections/${connectionId}/syncs/${sync.id}`;
                      }}
                      title="Repair field mapping"
                    >
                      <AlertTriangleIcon className="mr-1 h-3 w-3" />
                      Repair
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => triggerSync(sync.id)}
                      disabled={runningSync === sync.id}
                      title="Run sync now"
                    >
                      {runningSync === sync.id ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayIcon className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSync(sync.id)}
                    title="Delete sync"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
