"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, XIcon, SearchIcon, SaveIcon } from "lucide-react";

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

type SegmentFilter = {
  match: "all" | "any";
  conditions: Condition[];
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  filter: SegmentFilter;
};

type PreviewResult = {
  count: number;
  sample: Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  }>;
};

const CORE_FIELDS: FieldDefinition[] = [
  { id: "_email", name: "email", label: "Email", fieldType: "email", options: null },
  { id: "_first_name", name: "first_name", label: "First Name", fieldType: "text", options: null },
  { id: "_last_name", name: "last_name", label: "Last Name", fieldType: "text", options: null },
  { id: "_created_at", name: "created_at", label: "Created At", fieldType: "date", options: null },
  { id: "_tag", name: "tag", label: "Tag", fieldType: "tag", options: null },
];

function getOperators(fieldType: string) {
  switch (fieldType) {
    case "text":
    case "email":
    case "url":
      return [
        { value: "eq", label: "equals" },
        { value: "neq", label: "not equals" },
        { value: "contains", label: "contains" },
        { value: "not_contains", label: "doesn't contain" },
        { value: "starts_with", label: "starts with" },
        { value: "is_set", label: "is set" },
        { value: "is_not_set", label: "is not set" },
      ];
    case "number":
      return [
        { value: "eq", label: "equals" },
        { value: "neq", label: "not equals" },
        { value: "gt", label: "greater than" },
        { value: "gte", label: "greater or equal" },
        { value: "lt", label: "less than" },
        { value: "lte", label: "less or equal" },
        { value: "is_set", label: "is set" },
        { value: "is_not_set", label: "is not set" },
      ];
    case "date":
      return [
        { value: "eq", label: "equals" },
        { value: "after", label: "after" },
        { value: "before", label: "before" },
        { value: "is_set", label: "is set" },
        { value: "is_not_set", label: "is not set" },
      ];
    case "select":
      return [
        { value: "eq", label: "equals" },
        { value: "neq", label: "not equals" },
        { value: "in", label: "is one of" },
        { value: "is_set", label: "is set" },
        { value: "is_not_set", label: "is not set" },
      ];
    case "multiselect":
      return [
        { value: "contains", label: "contains" },
        { value: "is_set", label: "is set" },
        { value: "is_not_set", label: "is not set" },
      ];
    case "boolean":
      return [
        { value: "eq", label: "equals" },
      ];
    case "tag":
      return [
        { value: "has", label: "has tag" },
        { value: "not_has", label: "doesn't have tag" },
      ];
    default:
      return [
        { value: "eq", label: "equals" },
        { value: "contains", label: "contains" },
      ];
  }
}

function needsValue(operator: string) {
  return !["is_set", "is_not_set"].includes(operator);
}

const selectStyle =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function ConditionRow({
  condition,
  allFields,
  onChange,
  onRemove,
}: {
  condition: Condition;
  allFields: FieldDefinition[];
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  const fieldDef = allFields.find((f) => f.name === condition.field);
  const operators = getOperators(fieldDef?.fieldType || "text");

  return (
    <div className="flex items-center gap-2">
      {/* Field picker */}
      <select
        value={condition.field}
        onChange={(e) =>
          onChange({ ...condition, field: e.target.value, operator: "eq", value: "" })
        }
        className={`${selectStyle} w-40`}
      >
        <option value="">Select field...</option>
        <optgroup label="Core Fields">
          {CORE_FIELDS.map((f) => (
            <option key={f.id} value={f.name}>
              {f.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Custom Fields">
          {allFields
            .filter((f) => !f.id.startsWith("_"))
            .map((f) => (
              <option key={f.id} value={f.name}>
                {f.label}
              </option>
            ))}
        </optgroup>
      </select>

      {/* Operator picker */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className={`${selectStyle} w-36`}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {needsValue(condition.operator) && (
        <>
          {fieldDef?.fieldType === "select" && condition.operator !== "in" ? (
            <select
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              className={`${selectStyle} w-40`}
            >
              <option value="">Select...</option>
              {fieldDef.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : fieldDef?.fieldType === "boolean" ? (
            <select
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              className={`${selectStyle} w-40`}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : fieldDef?.fieldType === "date" || condition.field === "created_at" ? (
            <Input
              type="date"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              className="w-40"
            />
          ) : (
            <Input
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              placeholder="Value..."
              className="w-40"
            />
          )}
        </>
      )}

      <Button size="sm" variant="ghost" onClick={onRemove}>
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SegmentBuilder({
  fieldDefinitions,
  initialSegments,
}: {
  fieldDefinitions: FieldDefinition[];
  initialSegments: Segment[];
}) {
  const allFields = [...CORE_FIELDS, ...fieldDefinitions];
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "", operator: "eq", value: "" },
  ]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadSegment(segment: Segment) {
    setSelectedSegmentId(segment.id);
    setName(segment.name);
    setDescription(segment.description || "");
    setMatch(segment.filter.match);
    setConditions(
      segment.filter.conditions.length > 0
        ? segment.filter.conditions.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: typeof c.value === "string" ? c.value : String(c.value ?? ""),
          }))
        : [{ field: "", operator: "eq", value: "" }]
    );
    setPreview(null);
  }

  function resetForm() {
    setSelectedSegmentId(null);
    setName("");
    setDescription("");
    setMatch("all");
    setConditions([{ field: "", operator: "eq", value: "" }]);
    setPreview(null);
    setError(null);
  }

  function addCondition() {
    setConditions([...conditions, { field: "", operator: "eq", value: "" }]);
  }

  function updateCondition(index: number, updated: Condition) {
    const next = [...conditions];
    next[index] = updated;
    setConditions(next);
  }

  function removeCondition(index: number) {
    if (conditions.length === 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function getFilter(): SegmentFilter {
    return {
      match,
      conditions: conditions.filter((c) => c.field),
    };
  }

  async function runPreview() {
    setPreviewing(true);
    setError(null);

    const res = await fetch("/api/segments/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: getFilter() }),
    });

    if (res.ok) {
      setPreview(await res.json());
    } else {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        setError(data.error || "Preview failed.");
      } catch {
        setError(`Preview failed (${res.status}).`);
      }
    }
    setPreviewing(false);
  }

  async function saveSegment() {
    if (!name.trim()) {
      setError("Segment name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const filter = getFilter();
    const url = selectedSegmentId
      ? `/api/segments/${selectedSegmentId}`
      : "/api/segments";
    const method = selectedSegmentId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, filter }),
    });

    if (res.ok) {
      const saved = await res.json();
      if (selectedSegmentId) {
        setSegments(segments.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        setSegments([...segments, saved]);
        setSelectedSegmentId(saved.id);
      }
    } else {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        setError(data.error || "Save failed.");
      } catch {
        setError(`Save failed (${res.status}).`);
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this segment?")) return;
    const res = await fetch(`/api/segments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSegments(segments.filter((s) => s.id !== id));
      if (selectedSegmentId === id) resetForm();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Saved segments sidebar */}
      <div className="lg:col-span-1">
        <h3 className="text-sm font-semibold mb-2">Saved Segments</h3>
        <div className="space-y-1">
          <Button
            variant={selectedSegmentId === null ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start"
            onClick={resetForm}
          >
            <PlusIcon className="mr-2 h-3 w-3" />
            New Segment
          </Button>
          {segments.map((seg) => (
            <div key={seg.id} className="flex items-center gap-1">
              <Button
                variant={selectedSegmentId === seg.id ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 justify-start truncate"
                onClick={() => loadSegment(seg)}
              >
                {seg.name}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => handleDelete(seg.id)}
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Builder */}
      <div className="lg:col-span-3 space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Segment Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Active Netherlands volunteers"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this segment is for..."
              className="mt-1"
            />
          </div>
        </div>

        {/* Match type */}
        <div className="flex items-center gap-2 text-sm">
          <span>Contacts matching</span>
          <select
            value={match}
            onChange={(e) => setMatch(e.target.value as "all" | "any")}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          >
            <option value="all">ALL</option>
            <option value="any">ANY</option>
          </select>
          <span>of these conditions:</span>
        </div>

        {/* Conditions */}
        <div className="space-y-2">
          {conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              condition={cond}
              allFields={allFields}
              onChange={(c) => updateCondition(i, c)}
              onRemove={() => removeCondition(i)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addCondition}>
            <PlusIcon className="mr-1 h-3 w-3" />
            Add condition
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={runPreview}
            disabled={previewing || conditions.every((c) => !c.field)}
          >
            <SearchIcon className="mr-2 h-4 w-4" />
            {previewing ? "Previewing..." : "Preview"}
          </Button>
          <Button onClick={saveSegment} disabled={saving || !name.trim()}>
            <SaveIcon className="mr-2 h-4 w-4" />
            {saving
              ? "Saving..."
              : selectedSegmentId
                ? "Update Segment"
                : "Save Segment"}
          </Button>
        </div>

        {/* Preview results */}
        {preview && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-2">
              Preview: {preview.count} contact{preview.count !== 1 ? "s" : ""} match
            </h4>
            {preview.sample.length > 0 ? (
              <div className="text-sm space-y-1">
                {preview.sample.map((c) => (
                  <div key={c.id} className="flex gap-3 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {c.first_name} {c.last_name}
                    </span>
                    <span>{c.email}</span>
                  </div>
                ))}
                {preview.count > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ...and {preview.count - 10} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts match this filter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
