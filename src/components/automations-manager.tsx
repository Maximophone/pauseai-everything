"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  Trash2Icon,
  PlayIcon,
  PauseIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

type FieldDefinition = {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: string[] | null;
};

type Condition = {
  field: string;
  operator: string;
  value: string;
};

type Action =
  | { type: "set_field"; field: string; value: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string };

type AutomationRule = {
  id: string;
  name: string;
  description: string | null;
  config: {
    match: "all" | "any";
    conditions: Condition[];
    actions: Action[];
  };
  isActive: boolean;
  lastRunAt: string | null;
};

const selectStyle =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const ACTION_TYPES = [
  { value: "set_field", label: "Set field value" },
  { value: "add_tag", label: "Add tag" },
  { value: "remove_tag", label: "Remove tag" },
];

export function AutomationsManager({
  initialRules,
  fieldDefinitions,
}: {
  initialRules: AutomationRule[];
  fieldDefinitions: FieldDefinition[];
}) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "", operator: "eq", value: "" },
  ]);
  const [actions, setActions] = useState<Action[]>([
    { type: "set_field", field: "", value: "" },
  ]);

  async function refetch() {
    const res = await fetch("/api/automations");
    if (res.ok) setRules(await res.json());
  }

  function resetForm() {
    setName("");
    setDescription("");
    setMatch("all");
    setConditions([{ field: "", operator: "eq", value: "" }]);
    setActions([{ type: "set_field", field: "", value: "" }]);
    setShowCreate(false);
    setError(null);
  }

  async function createRule() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        config: {
          match,
          conditions: conditions.filter((c) => c.field),
          actions,
        },
      }),
    });

    if (res.ok) {
      resetForm();
      await refetch();
    } else {
      const text = await res.text();
      try {
        setError(JSON.parse(text).error || "Failed to create rule.");
      } catch {
        setError(`Failed (${res.status}).`);
      }
    }
    setSaving(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/automations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await refetch();
  }

  async function runRule(id: string) {
    setRunning(id);
    const res = await fetch(`/api/automations/${id}/run`, { method: "POST" });
    if (res.ok) {
      const { affected } = await res.json();
      alert(`Rule executed: ${affected} contacts affected.`);
      await refetch();
    }
    setRunning(null);
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this automation rule?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateAction(index: number, action: Action) {
    const next = [...actions];
    next[index] = action;
    setActions(next);
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
          New Rule
        </Button>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border p-4 space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold">New Automation Rule</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flag dormant NL contacts"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this rule does..."
                className="mt-1"
              />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              When contacts match{" "}
              <select
                value={match}
                onChange={(e) => setMatch(e.target.value as "all" | "any")}
                className="rounded border border-input bg-transparent px-1 text-xs"
              >
                <option value="all">ALL</option>
                <option value="any">ANY</option>
              </select>
              {" "}of:
            </label>
            <div className="mt-1 space-y-1">
              {conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={cond.field}
                    onChange={(e) => {
                      const next = [...conditions];
                      next[i] = { ...cond, field: e.target.value };
                      setConditions(next);
                    }}
                    className={`${selectStyle} w-36`}
                  >
                    <option value="">Field...</option>
                    {fieldDefinitions.map((f) => (
                      <option key={f.id} value={f.name}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => {
                      const next = [...conditions];
                      next[i] = { ...cond, operator: e.target.value };
                      setConditions(next);
                    }}
                    className={`${selectStyle} w-28`}
                  >
                    <option value="eq">equals</option>
                    <option value="neq">not equals</option>
                    <option value="contains">contains</option>
                    <option value="is_set">is set</option>
                    <option value="is_not_set">is not set</option>
                  </select>
                  <Input
                    value={cond.value}
                    onChange={(e) => {
                      const next = [...conditions];
                      next[i] = { ...cond, value: e.target.value };
                      setConditions(next);
                    }}
                    placeholder="Value"
                    className="w-32"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (conditions.length > 1) setConditions(conditions.filter((_, j) => j !== i));
                    }}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConditions([...conditions, { field: "", operator: "eq", value: "" }])
                }
              >
                <PlusIcon className="mr-1 h-3 w-3" /> Add condition
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Then:</label>
            <div className="mt-1 space-y-1">
              {actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={action.type}
                    onChange={(e) => {
                      const type = e.target.value as Action["type"];
                      if (type === "set_field") updateAction(i, { type, field: "", value: "" });
                      else if (type === "add_tag") updateAction(i, { type, tag: "" });
                      else updateAction(i, { type: "remove_tag", tag: "" });
                    }}
                    className={`${selectStyle} w-36`}
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  {action.type === "set_field" && (
                    <>
                      <select
                        value={action.field}
                        onChange={(e) =>
                          updateAction(i, { ...action, field: e.target.value })
                        }
                        className={`${selectStyle} w-32`}
                      >
                        <option value="">Field...</option>
                        {fieldDefinitions.map((f) => (
                          <option key={f.id} value={f.name}>{f.label}</option>
                        ))}
                      </select>
                      <Input
                        value={action.value}
                        onChange={(e) =>
                          updateAction(i, { ...action, value: e.target.value })
                        }
                        placeholder="Value"
                        className="w-32"
                      />
                    </>
                  )}

                  {(action.type === "add_tag" || action.type === "remove_tag") && (
                    <Input
                      value={action.tag}
                      onChange={(e) =>
                        updateAction(i, { ...action, tag: e.target.value } as Action)
                      }
                      placeholder="Tag name"
                      className="w-40"
                    />
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (actions.length > 1) setActions(actions.filter((_, j) => j !== i));
                    }}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActions([...actions, { type: "set_field", field: "", value: "" }])
                }
              >
                <PlusIcon className="mr-1 h-3 w-3" /> Add action
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={createRule} disabled={saving || !name.trim()} size="sm">
              {saving ? "Creating..." : "Create Rule"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No automation rules yet. Create one above.
        </p>
      )}

      {rules.length > 0 && (
        <div className="divide-y rounded-lg border">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <ZapIcon
                  className={`h-4 w-4 ${rule.isActive ? "text-yellow-500" : "text-muted-foreground"}`}
                />
                <div>
                  <div className="text-sm font-medium">
                    {rule.name}
                    {!rule.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">(paused)</span>
                    )}
                  </div>
                  {rule.description && (
                    <div className="text-xs text-muted-foreground">{rule.description}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {rule.config.conditions.length} condition{rule.config.conditions.length !== 1 ? "s" : ""}
                    {" → "}
                    {rule.config.actions.length} action{rule.config.actions.length !== 1 ? "s" : ""}
                    {rule.lastRunAt && (
                      <span className="ml-2">
                        Last run: {new Date(rule.lastRunAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => runRule(rule.id)}
                  disabled={running === rule.id}
                  title="Run now"
                >
                  <PlayIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive(rule.id, rule.isActive)}
                  title={rule.isActive ? "Pause" : "Activate"}
                >
                  {rule.isActive ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <ZapIcon className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteRule(rule.id)}
                  title="Delete"
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
