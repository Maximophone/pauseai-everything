"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";

type ExternalResource = { id: string; name: string };
type ExternalField = { id: string; name: string; type: string };
type CrmField = { value: string; label: string; group: string };

// ── Local flat state type ──────────────────────────────────
// Easier to manage in React than the discriminated-union API shape.
// Converted to/from the API format on load/save.
type UIMapping = {
  id: string;
  crmTarget: string;
  sourceType: "field" | "constant";
  // field source
  externalFieldId: string;
  externalFieldName: string;
  // constant source
  constantValue: string;
};

const CORE_CRM_FIELDS: CrmField[] = [
  { value: "_email", label: "Email", group: "Core" },
  { value: "_firstName", label: "First Name", group: "Core" },
  { value: "_lastName", label: "Last Name", group: "Core" },
];

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[_\-\s]/g, "");
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
}

function mkId() {
  return Math.random().toString(36).slice(2, 9);
}

function toApiEntry(m: UIMapping): { crmTarget: string; source: unknown } | null {
  if (!m.crmTarget) return null;
  if (m.sourceType === "field") {
    if (!m.externalFieldId) return null;
    return {
      crmTarget: m.crmTarget,
      source: { type: "field", externalFieldId: m.externalFieldId, externalFieldName: m.externalFieldName },
    };
  }
  // constant
  let value: unknown = m.constantValue;
  if (m.crmTarget === "_tags") {
    value = m.constantValue.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return { crmTarget: m.crmTarget, source: { type: "constant", value } };
}

export function SyncConfigWizard({ connectionId }: { connectionId: string }) {
  const [step, setStep] = useState(1);

  // Step 1: Select resource
  const [resources, setResources] = useState<ExternalResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);

  // Step 2: Field mapping
  const [externalFields, setExternalFields] = useState<ExternalField[]>([]);
  const [allCrmFields, setAllCrmFields] = useState<CrmField[]>([]);
  const [mappings, setMappings] = useState<UIMapping[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Step 3: Settings
  const [syncName, setSyncName] = useState("");
  const [syncFrequency, setSyncFrequency] = useState("manual");
  const [duplicateStrategy, setDuplicateStrategy] = useState("update");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load resources on mount
  useEffect(() => {
    async function load() {
      setLoadingResources(true);
      setResourceError(null);
      try {
        const res = await fetch(`/api/connections/${connectionId}/resources`);
        if (!res.ok) {
          const err = await res.json();
          setResourceError(err.error || "Failed to load resources");
          return;
        }
        setResources(await res.json());
      } catch {
        setResourceError("Failed to load resources");
      } finally {
        setLoadingResources(false);
      }
    }
    load();
  }, [connectionId]);

  // Load CRM field definitions
  useEffect(() => {
    async function loadFields() {
      const res = await fetch("/api/fields");
      if (res.ok) {
        const fields = (await res.json()) as { name: string; label: string }[];
        setAllCrmFields([
          ...CORE_CRM_FIELDS,
          { value: "_tags", label: "Tags", group: "Special" },
          ...fields.map((f) => ({ value: f.name, label: f.label, group: "Custom" })),
        ]);
      } else {
        setAllCrmFields([
          ...CORE_CRM_FIELDS,
          { value: "_tags", label: "Tags", group: "Special" },
        ]);
      }
    }
    loadFields();
  }, []);

  async function loadSchemaAndAdvance() {
    if (!selectedResourceId) return;
    setLoadingSchema(true);

    const resource = JSON.parse(selectedResourceId) as Record<string, string>;
    const params = new URLSearchParams(resource);
    const res = await fetch(`/api/connections/${connectionId}/resources/schema?${params}`);

    if (res.ok) {
      const fields = (await res.json()) as ExternalField[];
      setExternalFields(fields);

      // Auto-suggest: for each CRM field, find the best fuzzy-matched external field.
      // Tags are skipped from auto-suggest (usually a constant, not a mapped field).
      const usedExternalIds = new Set<string>();
      const autoMappings: UIMapping[] = [];
      const crmFieldsForAutoSuggest = [
        ...CORE_CRM_FIELDS,
        ...(allCrmFields.filter((f) => f.group === "Custom")),
      ];

      for (const crmField of crmFieldsForAutoSuggest) {
        const match = fields.find(
          (ext) => !usedExternalIds.has(ext.id) && fuzzyMatch(ext.name, crmField.label)
        );
        if (match) {
          usedExternalIds.add(match.id);
          autoMappings.push({
            id: mkId(),
            crmTarget: crmField.value,
            sourceType: "field",
            externalFieldId: match.id,
            externalFieldName: match.name,
            constantValue: "",
          });
        }
      }
      setMappings(autoMappings);

      const selectedResource = resources.find((r) => r.id === selectedResourceId);
      if (selectedResource && !syncName) {
        setSyncName(`Sync ${selectedResource.name}`);
      }

      setStep(2);
    }
    setLoadingSchema(false);
  }

  function addMapping() {
    setMappings((prev) => [
      ...prev,
      { id: mkId(), crmTarget: "", sourceType: "field", externalFieldId: "", externalFieldName: "", constantValue: "" },
    ]);
  }

  function updateMapping(id: string, patch: Partial<UIMapping>) {
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeMapping(id: string) {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  }

  function validateMappings(): boolean {
    setMappingError(null);
    const entries = mappings.map(toApiEntry).filter(Boolean);
    if (!entries.some((e) => e!.crmTarget === "_email" && (e!.source as { type: string }).type === "field")) {
      setMappingError("Email must be mapped from an external field — it's used for deduplication.");
      return false;
    }
    return true;
  }

  async function saveSyncConfig() {
    if (!validateMappings()) return;
    setSaving(true);
    setSaveError(null);

    const entries = mappings.map(toApiEntry).filter(Boolean);
    const resource = JSON.parse(selectedResourceId);

    const res = await fetch(`/api/connections/${connectionId}/syncs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: syncName.trim(),
        externalResource: resource,
        fieldMapping: { mappings: entries },
        externalSchema: externalFields,
        syncFrequency,
        duplicateStrategy,
      }),
    });

    if (res.ok) {
      window.location.href = `/dashboard/connections/${connectionId}`;
    } else {
      const err = await res.json();
      setSaveError(err.error || "Failed to create sync configuration");
    }
    setSaving(false);
  }

  // CRM targets already in use (to dim them in other rows' dropdowns)
  const usedCrmTargets = new Set(mappings.map((m) => m.crmTarget).filter(Boolean));

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step > 1) setStep(step - 1);
            else window.location.href = `/dashboard/connections/${connectionId}`;
          }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Sync Configuration</h2>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {/* Step 1: Select resource */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select a table to sync from</h3>

          {loadingResources && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading tables...
            </div>
          )}

          {resourceError && <p className="text-sm text-red-600">{resourceError}</p>}

          {!loadingResources && resources.length > 0 && (
            <>
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Choose a table...</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              <Button onClick={loadSchemaAndAdvance} disabled={!selectedResourceId || loadingSchema}>
                {loadingSchema ? (
                  <><Loader2Icon className="mr-2 h-4 w-4 animate-spin" />Loading schema...</>
                ) : (
                  <>Next <ArrowRightIcon className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </>
          )}

          {!loadingResources && resources.length === 0 && !resourceError && (
            <p className="text-sm text-muted-foreground">
              No tables found. Make sure the API token has access to at least one base.
            </p>
          )}
        </div>
      )}

      {/* Step 2: Field mapping */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Map fields</h3>
          <p className="text-sm text-muted-foreground">
            For each CRM field, choose an external field to pull from, or set a fixed value
            applied to every imported record (e.g. tags).
          </p>

          <div className="rounded-lg border divide-y">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_1fr_32px] gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <div>CRM Field</div>
              <div />
              <div>Source</div>
              <div />
            </div>

            {mappings.length === 0 && (
              <div className="px-4 py-6 text-sm text-center text-muted-foreground">
                No mappings yet — add one below or go back to reload suggestions.
              </div>
            )}

            {mappings.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto_1fr_32px] gap-3 px-4 py-2 items-center">

                {/* CRM target */}
                <select
                  value={m.crmTarget}
                  onChange={(e) => updateMapping(m.id, { crmTarget: e.target.value })}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs"
                >
                  <option value="">— CRM field —</option>
                  <optgroup label="Core">
                    {CORE_CRM_FIELDS.map((f) => (
                      <option
                        key={f.value}
                        value={f.value}
                        disabled={usedCrmTargets.has(f.value) && m.crmTarget !== f.value}
                      >
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Special">
                    <option
                      value="_tags"
                      disabled={usedCrmTargets.has("_tags") && m.crmTarget !== "_tags"}
                    >
                      Tags
                    </option>
                  </optgroup>
                  {allCrmFields.filter((f) => f.group === "Custom").length > 0 && (
                    <optgroup label="Custom Fields">
                      {allCrmFields
                        .filter((f) => f.group === "Custom")
                        .map((f) => (
                          <option
                            key={f.value}
                            value={f.value}
                            disabled={usedCrmTargets.has(f.value) && m.crmTarget !== f.value}
                          >
                            {f.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                {/* Source type toggle */}
                <div className="flex rounded-md border border-input overflow-hidden text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => updateMapping(m.id, { sourceType: "field", constantValue: "" })}
                    className={`px-2 py-1.5 transition-colors ${
                      m.sourceType === "field"
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Field
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMapping(m.id, { sourceType: "constant", externalFieldId: "", externalFieldName: "" })}
                    className={`px-2 py-1.5 transition-colors ${
                      m.sourceType === "constant"
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Fixed
                  </button>
                </div>

                {/* Source value */}
                {m.sourceType === "field" ? (
                  <select
                    value={m.externalFieldId}
                    onChange={(e) => {
                      const ext = externalFields.find((f) => f.id === e.target.value);
                      updateMapping(m.id, {
                        externalFieldId: ext?.id || "",
                        externalFieldName: ext?.name || "",
                      });
                    }}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs"
                  >
                    <option value="">— External field —</option>
                    {externalFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={m.constantValue}
                    onChange={(e) => updateMapping(m.id, { constantValue: e.target.value })}
                    placeholder={
                      m.crmTarget === "_tags"
                        ? "e.g. volunteer, airtable-import"
                        : "Fixed value…"
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs"
                  />
                )}

                {/* Remove */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeMapping(m.id)}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addMapping}>
            <PlusIcon className="mr-1 h-3 w-3" />
            Add mapping
          </Button>

          {mappingError && <p className="text-sm text-red-600">{mappingError}</p>}

          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (validateMappings()) setStep(3);
              }}
            >
              Next
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Settings */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Configure sync</h3>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Sync Name</label>
              <Input
                value={syncName}
                onChange={(e) => setSyncName(e.target.value)}
                placeholder="e.g. Import Airtable Volunteers"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Frequency</label>
              <select
                value={syncFrequency}
                onChange={(e) => setSyncFrequency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="manual">Manual only</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily (6am UTC)</option>
                <option value="weekly">Weekly (Monday 6am UTC)</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">
                When a contact already exists (same email)
              </label>
              <select
                value={duplicateStrategy}
                onChange={(e) => setDuplicateStrategy(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="update">Update mapped fields from external source</option>
                <option value="skip">Skip (don&apos;t touch existing contacts)</option>
              </select>
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <Button onClick={saveSyncConfig} disabled={saving || !syncName.trim()}>
            {saving ? (
              <><Loader2Icon className="mr-2 h-4 w-4 animate-spin" />Creating...</>
            ) : (
              "Create Sync Configuration"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
