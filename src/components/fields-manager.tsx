"use client";

import { useState } from "react";
import { useHasRole } from "@/lib/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
  GripVerticalIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Single Select" },
  { value: "multiselect", label: "Multi Select" },
] as const;

type FieldDefinition = {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: string[] | null;
  sortOrder: number;
  scope?: string;
  workspaceId?: string | null;
  createdAt: string;
};

type EditingField = {
  label: string;
  fieldType: string;
  options: string[];
};

type NewField = {
  name: string;
  label: string;
  fieldType: string;
  options: string[];
  scope?: string;
};

const emptyNewField: NewField = {
  name: "",
  label: "",
  fieldType: "text",
  options: [],
  scope: undefined,
};

function hasOptions(type: string) {
  return type === "select" || type === "multiselect";
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addOption() {
    const trimmed = draft.trim();
    if (!trimmed || options.includes(trimmed)) return;
    onChange([...options, trimmed]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Options
      </label>
      <div className="flex flex-wrap gap-1">
        {options.map((opt, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {opt}
            <button
              type="button"
              className="hover:text-destructive"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add option..."
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={addOption}
          disabled={!draft.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  core: "Core (all workspaces)",
  global_internal: "Global internal",
  workspace: "This workspace only",
};

export function FieldsManager({
  initialFields,
  isGlobalWorkspace = false,
}: {
  initialFields: FieldDefinition[];
  isGlobalWorkspace?: boolean;
}) {
  const isAdmin = useHasRole("admin");
  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditingField | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newField, setNewField] = useState<NewField>(emptyNewField);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refetch() {
    const res = await fetch("/api/fields");
    if (res.ok) setFields(await res.json());
  }

  // --- Create ---
  async function createField() {
    if (!newField.name.trim() || !newField.label.trim()) return;
    setSaving(true);
    setError(null);

    const maxSort = fields.reduce(
      (m, f) => Math.max(m, f.sortOrder),
      0
    );

    const res = await fetch("/api/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newField.name.trim().toLowerCase().replace(/\s+/g, "_"),
        label: newField.label.trim(),
        fieldType: newField.fieldType,
        options: hasOptions(newField.fieldType) ? newField.options : null,
        sortOrder: maxSort + 1,
        ...(isGlobalWorkspace && newField.scope ? { scope: newField.scope } : {}),
      }),
    });

    if (res.ok) {
      setNewField(emptyNewField);
      setShowCreate(false);
      await refetch();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create field.");
    }
    setSaving(false);
  }

  // --- Edit ---
  function startEdit(field: FieldDefinition) {
    setEditingId(field.id);
    setEditData({
      label: field.label,
      fieldType: field.fieldType,
      options: field.options || [],
    });
  }

  async function saveEdit(id: string) {
    if (!editData || !editData.label.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/fields/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editData.label.trim(),
        fieldType: editData.fieldType,
        options: hasOptions(editData.fieldType) ? editData.options : null,
      }),
    });

    if (res.ok) {
      setEditingId(null);
      setEditData(null);
      await refetch();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update field.");
    }
    setSaving(false);
  }

  // --- Delete ---
  async function deleteField(id: string, label: string) {
    if (
      !confirm(
        `Delete field "${label}"? Existing contact data for this field will become orphaned.`
      )
    )
      return;

    const res = await fetch(`/api/fields/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFields(fields.filter((f) => f.id !== id));
    }
  }

  // --- Reorder ---
  async function moveField(id: string, direction: "up" | "down") {
    const idx = fields.findIndex((f) => f.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === fields.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const currentOrder = fields[idx].sortOrder;
    const swapOrder = fields[swapIdx].sortOrder;

    // Swap sort orders via API
    await Promise.all([
      fetch(`/api/fields/${fields[idx].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapOrder }),
      }),
      fetch(`/api/fields/${fields[swapIdx].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: currentOrder }),
      }),
    ]);

    await refetch();
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Create button */}
      {!showCreate && (
        <span title={!isAdmin ? "Admin access required" : undefined}>
          <Button onClick={() => setShowCreate(true)} disabled={!isAdmin}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </span>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Field</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Label (display name)
              </label>
              <Input
                value={newField.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setNewField({
                    ...newField,
                    label,
                    // Auto-generate name from label
                    name: label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_|_$/g, ""),
                  });
                }}
                placeholder="e.g. Country"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Internal name
              </label>
              <Input
                value={newField.name}
                onChange={(e) =>
                  setNewField({ ...newField, name: e.target.value })
                }
                placeholder="e.g. country"
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <select
              value={newField.fieldType}
              onChange={(e) =>
                setNewField({
                  ...newField,
                  fieldType: e.target.value,
                  options: [],
                })
              }
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isGlobalWorkspace && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Field Scope
              </label>
              <select
                value={newField.scope || "core"}
                onChange={(e) =>
                  setNewField({ ...newField, scope: e.target.value })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="core">Core (visible to all workspaces)</option>
                <option value="global_internal">Global internal (Global workspace only)</option>
              </select>
            </div>
          )}

          {hasOptions(newField.fieldType) && (
            <OptionsEditor
              options={newField.options}
              onChange={(opts) => setNewField({ ...newField, options: opts })}
            />
          )}

          <div className="flex gap-2">
            <span title={!isAdmin ? "Admin access required" : undefined}>
              <Button
                onClick={createField}
                disabled={
                  !isAdmin || !newField.name.trim() || !newField.label.trim() || saving
                }
                size="sm"
              >
                {saving ? "Creating..." : "Create Field"}
              </Button>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setNewField(emptyNewField);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Field list */}
      {fields.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No custom fields defined yet. Add one above.
        </p>
      )}

      <div className="divide-y rounded-lg border">
        {fields.map((field, idx) => (
          <div key={field.id} className="px-4 py-3">
            {editingId === field.id && editData ? (
              /* --- Editing --- */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Label
                    </label>
                    <Input
                      value={editData.label}
                      onChange={(e) =>
                        setEditData({ ...editData, label: e.target.value })
                      }
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Type
                    </label>
                    <select
                      value={editData.fieldType}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          fieldType: e.target.value,
                          options:
                            hasOptions(e.target.value) ? editData.options : [],
                        })
                      }
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {hasOptions(editData.fieldType) && (
                  <OptionsEditor
                    options={editData.options}
                    onChange={(opts) =>
                      setEditData({ ...editData, options: opts })
                    }
                  />
                )}

                <div className="flex gap-2">
                  <span title={!isAdmin ? "Admin access required" : undefined}>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(field.id)}
                      disabled={!isAdmin || saving || !editData.label.trim()}
                    >
                      <CheckIcon className="mr-1 h-3 w-3" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                      setEditData(null);
                      setError(null);
                    }}
                  >
                    <XIcon className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* --- Display --- */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => moveField(field.id, "up")}
                    >
                      <ChevronUpIcon className="h-3 w-3" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === fields.length - 1}
                      onClick={() => moveField(field.id, "down")}
                    >
                      <ChevronDownIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {field.label}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="bg-muted px-1 rounded">
                        {field.name}
                      </code>
                      {field.scope && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          field.scope === "core" ? "bg-blue-100 text-blue-700" :
                          field.scope === "global_internal" ? "bg-purple-100 text-purple-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {SCOPE_LABELS[field.scope] || field.scope}
                        </span>
                      )}
                      <span className="capitalize">
                        {
                          FIELD_TYPES.find((t) => t.value === field.fieldType)
                            ?.label || field.fieldType
                        }
                      </span>
                      {field.options && field.options.length > 0 && (
                        <span>
                          ({field.options.length} option
                          {field.options.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(field)}
                    disabled={!isAdmin}
                    title={!isAdmin ? "Admin access required" : undefined}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <span title={!isAdmin ? "Admin access required" : undefined}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteField(field.id, field.label)}
                      disabled={!isAdmin}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
