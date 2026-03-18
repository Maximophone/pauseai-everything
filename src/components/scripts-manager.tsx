"use client";

import { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  Trash2Icon,
  PlayIcon,
  PauseIcon,
  ZapIcon,
  SaveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  HistoryIcon,
  FileCodeIcon,
} from "lucide-react";
import { SCRIPT_TEMPLATES, type ScriptTemplate } from "@/lib/script-templates";

type Script = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  cronSchedule: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

type ScriptRun = {
  id: string;
  scriptId: string;
  status: string;
  log: string | null;
  error: string | null;
  contactsAffected: string | null;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string | null;
};

const CRON_PRESETS = [
  { label: "No schedule (manual only)", value: "" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 6am UTC", value: "0 6 * * *" },
  { label: "Every day at midnight UTC", value: "0 0 * * *" },
  { label: "Every Monday at 9am UTC", value: "0 9 * * 1" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
];

export function ScriptsManager({ initialScripts }: { initialScripts: Script[] }) {
  const [scripts, setScripts] = useState<Script[]>(initialScripts);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<string | null>(null);
  const [runs, setRuns] = useState<ScriptRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{
    status: string;
    log: string;
    error?: string;
    contactsAffected: number;
  } | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [cronSchedule, setCronSchedule] = useState("");
  const [customCron, setCustomCron] = useState(false);

  async function refetch() {
    const res = await fetch("/api/scripts");
    if (res.ok) setScripts(await res.json());
  }

  function startFromTemplate(template: ScriptTemplate) {
    setName(template.name);
    setDescription(template.description);
    setCode(template.code);
    setCronSchedule("");
    setCustomCron(false);
    setShowCreate(true);
  }

  function resetForm() {
    setName("");
    setDescription("");
    setCode("");
    setCronSchedule("");
    setCustomCron(false);
    setShowCreate(false);
    setError(null);
  }

  async function createNewScript() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        code,
        cronSchedule: cronSchedule.trim() || null,
      }),
    });

    if (res.ok) {
      resetForm();
      await refetch();
    } else {
      const text = await res.text();
      try {
        setError(JSON.parse(text).error || "Failed to create script.");
      } catch {
        setError(`Failed (${res.status}).`);
      }
    }
    setLoading(false);
  }

  async function saveScript() {
    if (!editingScript) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/scripts/${editingScript.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingScript.name,
        description: editingScript.description,
        code: editingScript.code,
        cronSchedule: editingScript.cronSchedule,
        enabled: editingScript.enabled,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setEditingScript(updated);
      await refetch();
    } else {
      const text = await res.text();
      try {
        setError(JSON.parse(text).error || "Save failed.");
      } catch {
        setError(`Save failed (${res.status}).`);
      }
    }
    setLoading(false);
  }

  async function runScript(scriptId: string) {
    setLoading(true);
    setRunResult(null);
    setError(null);

    const res = await fetch(`/api/scripts/${scriptId}/run`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      setRunResult(result);
      await refetch();
      // Refresh runs if viewing them
      if (expandedRuns === scriptId) {
        await loadRuns(scriptId);
      }
    } else {
      const text = await res.text();
      try {
        setError(JSON.parse(text).error || "Run failed.");
      } catch {
        setError(`Run failed (${res.status}).`);
      }
    }
    setLoading(false);
  }

  async function toggleEnabled(script: Script) {
    await fetch(`/api/scripts/${script.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !script.enabled }),
    });
    await refetch();
  }

  async function deleteScriptById(id: string) {
    if (!confirm("Delete this script and all its run history?")) return;
    await fetch(`/api/scripts/${id}`, { method: "DELETE" });
    if (editingScript?.id === id) setEditingScript(null);
    setScripts(scripts.filter((s) => s.id !== id));
  }

  async function loadRuns(scriptId: string) {
    const res = await fetch(`/api/scripts/${scriptId}/runs`);
    if (res.ok) setRuns(await res.json());
  }

  function toggleRuns(scriptId: string) {
    if (expandedRuns === scriptId) {
      setExpandedRuns(null);
      setRuns([]);
    } else {
      setExpandedRuns(scriptId);
      loadRuns(scriptId);
    }
  }

  const onCodeChange = useCallback((val: string) => {
    if (editingScript) {
      setEditingScript({ ...editingScript, code: val });
    }
  }, [editingScript]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Run result banner */}
      {runResult && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            runResult.status === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {runResult.status === "success" ? (
              <CheckCircle2Icon className="h-4 w-4" />
            ) : (
              <XCircleIcon className="h-4 w-4" />
            )}
            Script {runResult.status} — {runResult.contactsAffected} contact
            {runResult.contactsAffected !== 1 ? "s" : ""} affected
          </div>
          {runResult.error && (
            <pre className="mt-1 text-xs whitespace-pre-wrap">{runResult.error}</pre>
          )}
          {runResult.log && (
            <pre className="mt-2 text-xs bg-black/5 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {runResult.log}
            </pre>
          )}
          <button
            className="mt-2 text-xs underline opacity-60 hover:opacity-100"
            onClick={() => setRunResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!showCreate && !editingScript && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => startFromTemplate(SCRIPT_TEMPLATES[0])}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Script
          </Button>
          <div className="relative group">
            <Button variant="outline">
              <FileCodeIcon className="mr-2 h-4 w-4" />
              From Template
              <ChevronDownIcon className="ml-1 h-3 w-3" />
            </Button>
            <div className="absolute left-0 top-full mt-1 w-64 bg-background border rounded-lg shadow-lg z-10 hidden group-hover:block">
              {SCRIPT_TEMPLATES.filter((_, i) => i > 0).map((tpl) => (
                <button
                  key={tpl.name}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent first:rounded-t-lg last:rounded-b-lg"
                  onClick={() => startFromTemplate(tpl)}
                >
                  <div className="font-medium">{tpl.name}</div>
                  <div className="text-xs text-muted-foreground">{tpl.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Script</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flag dormant contacts"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this script does..."
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Schedule</label>
            <div className="flex gap-2 mt-1">
              <select
                value={customCron ? "__custom__" : cronSchedule}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomCron(true);
                  } else {
                    setCustomCron(false);
                    setCronSchedule(e.target.value);
                  }
                }}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="__custom__">Custom cron...</option>
              </select>
              {customCron && (
                <Input
                  value={cronSchedule}
                  onChange={(e) => setCronSchedule(e.target.value)}
                  placeholder="*/5 * * * *"
                  className="w-40"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Code</label>
            <div className="mt-1 rounded-md border overflow-hidden">
              <CodeMirror
                value={code}
                onChange={setCode}
                extensions={[javascript()]}
                height="300px"
                theme="dark"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  autocompletion: true,
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={createNewScript} disabled={loading || !name.trim()} size="sm">
              {loading ? "Creating..." : "Create Script"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Edit view */}
      {editingScript && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Editing: {editingScript.name}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingScript(null);
                setRunResult(null);
              }}
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={editingScript.name}
                onChange={(e) =>
                  setEditingScript({ ...editingScript, name: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={editingScript.description || ""}
                onChange={(e) =>
                  setEditingScript({
                    ...editingScript,
                    description: e.target.value || null,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Schedule</label>
            <div className="flex gap-2 mt-1">
              <select
                value={
                  CRON_PRESETS.some((p) => p.value === (editingScript.cronSchedule || ""))
                    ? editingScript.cronSchedule || ""
                    : "__custom__"
                }
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    // Keep current value, just switch to custom mode
                  } else {
                    setEditingScript({
                      ...editingScript,
                      cronSchedule: e.target.value || null,
                    });
                  }
                }}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="__custom__">Custom cron...</option>
              </select>
              {!CRON_PRESETS.some(
                (p) => p.value === (editingScript.cronSchedule || "")
              ) && (
                <Input
                  value={editingScript.cronSchedule || ""}
                  onChange={(e) =>
                    setEditingScript({
                      ...editingScript,
                      cronSchedule: e.target.value || null,
                    })
                  }
                  placeholder="*/5 * * * *"
                  className="w-40"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Code</label>
            <div className="mt-1 rounded-md border overflow-hidden">
              <CodeMirror
                value={editingScript.code}
                onChange={onCodeChange}
                extensions={[javascript()]}
                height="400px"
                theme="dark"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  autocompletion: true,
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveScript} disabled={loading} size="sm">
              <SaveIcon className="mr-1 h-3 w-3" />
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button
              onClick={() => runScript(editingScript.id)}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              <PlayIcon className="mr-1 h-3 w-3" />
              {loading ? "Running..." : "Run Now"}
            </Button>
          </div>
        </div>
      )}

      {/* Scripts list */}
      {scripts.length === 0 && !showCreate && !editingScript && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No scripts yet. Create one to get started.
        </p>
      )}

      {scripts.length > 0 && !editingScript && (
        <div className="divide-y rounded-lg border">
          {scripts.map((script) => (
            <div key={script.id}>
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                  onClick={() => {
                    setEditingScript(script);
                    setShowCreate(false);
                    setRunResult(null);
                  }}
                >
                  <ZapIcon
                    className={`h-4 w-4 shrink-0 ${
                      script.enabled ? "text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {script.name}
                      {!script.enabled && (
                        <span className="ml-2 text-xs text-muted-foreground">(disabled)</span>
                      )}
                    </div>
                    {script.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {script.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {script.cronSchedule && (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          {script.cronSchedule}
                        </span>
                      )}
                      {script.lastRunAt && (
                        <span className="flex items-center gap-1">
                          {script.lastRunStatus === "success" ? (
                            <CheckCircle2Icon className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-3 w-3 text-red-500" />
                          )}
                          Last run: {new Date(script.lastRunAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runScript(script.id)}
                    disabled={loading}
                    title="Run now"
                  >
                    <PlayIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleRuns(script.id)}
                    title="Run history"
                  >
                    <HistoryIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleEnabled(script)}
                    title={script.enabled ? "Disable" : "Enable"}
                  >
                    {script.enabled ? (
                      <PauseIcon className="h-4 w-4" />
                    ) : (
                      <ZapIcon className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteScriptById(script.id)}
                    title="Delete"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Run history */}
              {expandedRuns === script.id && (
                <div className="px-4 pb-3">
                  <div className="rounded border bg-muted/30 p-3">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <HistoryIcon className="h-3 w-3" /> Recent Runs
                    </h4>
                    {runs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No runs yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {runs.map((run) => (
                          <RunEntry key={run.id} run={run} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunEntry({ run }: { run: ScriptRun }) {
  const [expanded, setExpanded] = useState(false);
  const duration =
    run.completedAt && run.startedAt
      ? Math.round(
          (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
        )
      : null;

  return (
    <div className="text-xs">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 shrink-0" />
        )}
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            run.status === "success"
              ? "bg-green-100 text-green-700"
              : run.status === "error"
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {run.status}
        </span>
        <span className="text-muted-foreground">
          {new Date(run.startedAt).toLocaleString()}
        </span>
        {duration !== null && (
          <span className="text-muted-foreground">({duration}s)</span>
        )}
        {run.contactsAffected && Number(run.contactsAffected) > 0 && (
          <span className="text-muted-foreground">
            {run.contactsAffected} contact{Number(run.contactsAffected) !== 1 ? "s" : ""}
          </span>
        )}
        <span className="text-muted-foreground ml-auto">{run.triggeredBy}</span>
      </button>

      {expanded && (
        <div className="mt-1 ml-5 space-y-1">
          {run.error && (
            <pre className="text-red-600 bg-red-50 rounded p-2 whitespace-pre-wrap">
              {run.error}
            </pre>
          )}
          {run.log ? (
            <pre className="bg-black/5 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {run.log}
            </pre>
          ) : (
            <p className="text-muted-foreground italic">No log output.</p>
          )}
        </div>
      )}
    </div>
  );
}
