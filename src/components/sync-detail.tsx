"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftIcon,
  PlayIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";

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
  fieldMapping: {
    mappings: {
      externalFieldId: string;
      externalFieldName: string;
      crmTarget: string;
      transform?: string;
    }[];
  };
  externalResource: Record<string, unknown>;
  externalSchema: { id: string; name: string; type: string }[];
};

type SyncRun = {
  id: string;
  status: string;
  log: string | null;
  error: string | null;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsErrored: number;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
};

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
    case "partial":
      return <AlertTriangleIcon className="h-4 w-4 text-amber-600" />;
    case "error":
      return <XCircleIcon className="h-4 w-4 text-red-600" />;
    case "running":
      return <Loader2Icon className="h-4 w-4 text-blue-600 animate-spin" />;
    default:
      return null;
  }
}

const CORE_CRM_FIELDS = [
  { value: "_email", label: "Email" },
  { value: "_firstName", label: "First Name" },
  { value: "_lastName", label: "Last Name" },
];

const CRM_TARGET_LABELS: Record<string, string> = {
  _email: "Email",
  _firstName: "First Name",
  _lastName: "Last Name",
};

type CrmField = { value: string; label: string };

export function SyncDetail({
  connectionId,
  syncId,
}: {
  connectionId: string;
  syncId: string;
}) {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSync, setRunningSync] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editMappings, setEditMappings] = useState<SyncConfig["fieldMapping"]["mappings"]>([]);
  const [crmFields, setCrmFields] = useState<CrmField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function fetchData() {
    const [configRes, runsRes] = await Promise.all([
      fetch(`/api/connections/${connectionId}/syncs/${syncId}`),
      fetch(`/api/connections/${connectionId}/syncs/${syncId}/runs`),
    ]);

    if (configRes.ok) setConfig(await configRes.json());
    if (runsRes.ok) setRuns(await runsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [connectionId, syncId]);

  // Auto-refresh when a sync is running
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [runs]);

  // Load CRM field definitions when entering edit mode
  async function loadCrmFields() {
    const res = await fetch("/api/fields");
    if (res.ok) {
      const fields = (await res.json()) as { name: string; label: string }[];
      setCrmFields([
        ...CORE_CRM_FIELDS,
        ...fields.map((f) => ({ value: f.name, label: f.label })),
      ]);
    }
  }

  function startEditing() {
    if (!config) return;
    setEditMappings(config.fieldMapping.mappings.map((m) => ({ ...m })));
    setSaveError(null);
    setEditing(true);
    loadCrmFields();
  }

  function cancelEditing() {
    setEditing(false);
    setEditMappings([]);
    setSaveError(null);
  }

  function updateEditMapping(index: number, crmTarget: string) {
    setEditMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, crmTarget } : m))
    );
  }

  function removeEditMapping(index: number) {
    setEditMappings((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveMapping() {
    setSaving(true);
    setSaveError(null);

    const activeMappings = editMappings.filter((m) => m.crmTarget !== "");

    if (!activeMappings.some((m) => m.crmTarget === "_email")) {
      setSaveError("Email field must be mapped for duplicate detection.");
      setSaving(false);
      return;
    }

    // Also re-fetch the external schema if repairing
    let externalSchema = config?.externalSchema;
    if (config?.status === "needs_repair") {
      try {
        const resource = config.externalResource;
        const params = new URLSearchParams(resource as Record<string, string>);
        const schemaRes = await fetch(
          `/api/connections/${connectionId}/resources/schema?${params}`
        );
        if (schemaRes.ok) {
          externalSchema = await schemaRes.json();
        }
      } catch {
        // If schema fetch fails, proceed with existing schema
      }
    }

    const res = await fetch(
      `/api/connections/${connectionId}/syncs/${syncId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldMapping: { mappings: activeMappings },
          ...(externalSchema ? { externalSchema } : {}),
        }),
      }
    );

    if (res.ok) {
      setEditing(false);
      await fetchData();
    } else {
      const err = await res.json();
      setSaveError(err.error || "Failed to save");
    }
    setSaving(false);
  }

  async function triggerSync() {
    setRunningSync(true);
    await fetch(
      `/api/connections/${connectionId}/syncs/${syncId}/run`,
      { method: "POST" }
    );
    setTimeout(() => {
      fetchData();
      setRunningSync(false);
    }, 2000);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!config) {
    return <p className="text-sm text-red-600">Sync configuration not found.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.location.href = `/dashboard/settings/connections/${connectionId}`;
          }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{config.name}</h2>
          <p className="text-sm text-muted-foreground">
            {config.syncFrequency === "manual"
              ? "Manual sync"
              : `Syncs ${config.syncFrequency}`}{" "}
            · {config.duplicateStrategy === "update" ? "Updates duplicates" : "Skips duplicates"}
          </p>
        </div>
        <Button
          onClick={triggerSync}
          disabled={runningSync || config.status === "needs_repair"}
        >
          {runningSync ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlayIcon className="mr-2 h-4 w-4" />
          )}
          Run Now
        </Button>
      </div>

      {/* Needs repair warning */}
      {config.status === "needs_repair" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <AlertTriangleIcon className="h-4 w-4" />
            This sync needs repair
          </div>
          <p className="text-sm text-amber-700 mt-1">
            {config.statusMessage}
          </p>
          <p className="text-xs text-amber-600 mt-2">
            Update the field mapping to fix broken fields, then try running
            again.
          </p>
        </div>
      )}

      {/* Field mapping */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Field Mapping</h3>
          {!editing && (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <PencilIcon className="mr-2 h-3 w-3" />
              {config.status === "needs_repair" ? "Repair" : "Edit"}
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="rounded-lg border divide-y">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                <div>External Field</div>
                <div>CRM Field</div>
                <div></div>
              </div>
              {editMappings.map((m, i) => (
                <div
                  key={m.externalFieldId}
                  className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-2 items-center"
                >
                  <div className="text-sm">{m.externalFieldName}</div>
                  <select
                    value={m.crmTarget}
                    onChange={(e) => updateEditMapping(i, e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs"
                  >
                    <option value="">-- Skip --</option>
                    <optgroup label="Core">
                      {CORE_CRM_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                    {crmFields.filter((f) => !f.value.startsWith("_")).length > 0 && (
                      <optgroup label="Custom Fields">
                        {crmFields
                          .filter((f) => !f.value.startsWith("_"))
                          .map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeEditMapping(i)}
                    title="Remove mapping"
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={saveMapping} disabled={saving}>
                {saving ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SaveIcon className="mr-2 h-4 w-4" />
                )}
                Save Mapping
              </Button>
              <Button variant="ghost" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <div>External Field</div>
              <div>CRM Field</div>
            </div>
            {config.fieldMapping.mappings.map((m) => (
              <div
                key={m.externalFieldId}
                className="grid grid-cols-2 gap-4 px-4 py-2 text-sm"
              >
                <div>{m.externalFieldName}</div>
                <div className="font-medium">
                  {CRM_TARGET_LABELS[m.crmTarget] || m.crmTarget}
                  {m.transform && m.transform !== "none" && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({m.transform})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Run History</h3>

        {runs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No sync runs yet. Click &quot;Run Now&quot; to start the first sync.
          </p>
        )}

        {runs.length > 0 && (
          <div className="rounded-lg border divide-y">
            {runs.map((run) => (
              <div key={run.id}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
                  onClick={() =>
                    setExpandedRun(expandedRun === run.id ? null : run.id)
                  }
                >
                  {expandedRun === run.id ? (
                    <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                  <RunStatusIcon status={run.status} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({run.triggeredBy})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-x-2">
                    {run.status !== "running" && (
                      <>
                        <span className="text-green-600">
                          +{run.recordsCreated}
                        </span>
                        <span className="text-blue-600">
                          ~{run.recordsUpdated}
                        </span>
                        {run.recordsSkipped > 0 && (
                          <span className="text-gray-500">
                            ={run.recordsSkipped}
                          </span>
                        )}
                        {run.recordsErrored > 0 && (
                          <span className="text-red-600">
                            !{run.recordsErrored}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </button>

                {expandedRun === run.id && (
                  <div className="px-4 pb-3 border-t bg-muted/20">
                    {run.error && (
                      <p className="text-sm text-red-600 py-2">
                        Error: {run.error}
                      </p>
                    )}
                    {run.log && (
                      <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground py-2 max-h-60 overflow-auto">
                        {run.log}
                      </pre>
                    )}
                    {!run.log && !run.error && (
                      <p className="text-xs text-muted-foreground py-2">
                        No log available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
