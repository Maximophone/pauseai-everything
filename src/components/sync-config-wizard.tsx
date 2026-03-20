"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";

type ExternalResource = {
  id: string;
  name: string;
};

type ExternalField = {
  id: string;
  name: string;
  type: string;
};

type CrmField = {
  value: string;
  label: string;
  group: string;
};

type FieldMappingEntry = {
  externalFieldId: string;
  externalFieldName: string;
  crmTarget: string;
  transform?: string;
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

export function SyncConfigWizard({
  connectionId,
}: {
  connectionId: string;
}) {
  const [step, setStep] = useState(1);

  // Step 1: Select resource
  const [resources, setResources] = useState<ExternalResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);

  // Step 2: Field mapping
  const [externalFields, setExternalFields] = useState<ExternalField[]>([]);
  const [crmFields, setCrmFields] = useState<CrmField[]>([]);
  const [mappings, setMappings] = useState<FieldMappingEntry[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);

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
        const fields = (await res.json()) as {
          name: string;
          label: string;
        }[];
        setCrmFields([
          ...CORE_CRM_FIELDS,
          ...fields.map((f) => ({
            value: f.name,
            label: f.label,
            group: "Custom",
          })),
        ]);
      }
    }
    loadFields();
  }, []);

  // Load schema when resource is selected and user moves to step 2
  async function loadSchemaAndAdvance() {
    if (!selectedResourceId) return;
    setLoadingSchema(true);

    const resource = JSON.parse(selectedResourceId) as Record<string, string>;
    const params = new URLSearchParams(resource);

    const res = await fetch(
      `/api/connections/${connectionId}/resources/schema?${params}`
    );

    if (res.ok) {
      const fields = (await res.json()) as ExternalField[];
      setExternalFields(fields);

      // Auto-suggest mappings by fuzzy name match
      const autoMappings: FieldMappingEntry[] = fields.map((ext) => {
        const match = crmFields.find((crm) => fuzzyMatch(ext.name, crm.label));
        return {
          externalFieldId: ext.id,
          externalFieldName: ext.name,
          crmTarget: match?.value || "",
        };
      });
      setMappings(autoMappings);

      // Auto-set sync name
      const selectedResource = resources.find(
        (r) => r.id === selectedResourceId
      );
      if (selectedResource && !syncName) {
        setSyncName(`Sync ${selectedResource.name}`);
      }

      setStep(2);
    }
    setLoadingSchema(false);
  }

  function updateMapping(index: number, crmTarget: string) {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, crmTarget } : m))
    );
  }

  async function saveSyncConfig() {
    setSaving(true);
    setSaveError(null);

    const activeMappings = mappings.filter((m) => m.crmTarget !== "");

    // Must have at least email mapped
    if (!activeMappings.some((m) => m.crmTarget === "_email")) {
      setSaveError("Email field must be mapped for duplicate detection.");
      setSaving(false);
      return;
    }

    const resource = JSON.parse(selectedResourceId);

    const res = await fetch(`/api/connections/${connectionId}/syncs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: syncName.trim(),
        externalResource: resource,
        fieldMapping: { mappings: activeMappings },
        externalSchema: externalFields,
        syncFrequency,
        duplicateStrategy,
      }),
    });

    if (res.ok) {
      window.location.href = `/dashboard/settings/connections/${connectionId}`;
    } else {
      const err = await res.json();
      setSaveError(err.error || "Failed to create sync configuration");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              window.location.href = `/dashboard/settings/connections/${connectionId}`;
            }
          }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            New Sync Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Step {step} of 3
          </p>
        </div>
      </div>

      {/* Step 1: Select resource */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            Select a table to sync from
          </h3>

          {loadingResources && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading tables...
            </div>
          )}

          {resourceError && (
            <p className="text-sm text-red-600">{resourceError}</p>
          )}

          {!loadingResources && resources.length > 0 && (
            <>
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">Choose a table...</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <Button
                onClick={loadSchemaAndAdvance}
                disabled={!selectedResourceId || loadingSchema}
              >
                {loadingSchema ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Loading schema...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {!loadingResources && resources.length === 0 && !resourceError && (
            <p className="text-sm text-muted-foreground">
              No tables found. Make sure the API token has access to at least one
              base.
            </p>
          )}
        </div>
      )}

      {/* Step 2: Field mapping */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Map fields</h3>
          <p className="text-sm text-muted-foreground">
            Match external fields to CRM fields. Leave unmatched to skip.
          </p>

          <div className="rounded-lg border divide-y">
            <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <div>External Field</div>
              <div>CRM Field</div>
            </div>
            {mappings.map((mapping, i) => (
              <div
                key={mapping.externalFieldId}
                className="grid grid-cols-2 gap-4 px-4 py-2 items-center"
              >
                <div>
                  <span className="text-sm">{mapping.externalFieldName}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({externalFields[i]?.type})
                  </span>
                </div>
                <select
                  value={mapping.crmTarget}
                  onChange={(e) => updateMapping(i, e.target.value)}
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
                  {crmFields.filter((f) => f.group === "Custom").length > 0 && (
                    <optgroup label="Custom Fields">
                      {crmFields
                        .filter((f) => f.group === "Custom")
                        .map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setStep(3)}>
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
                <option value="update">
                  Update mapped fields from external source
                </option>
                <option value="skip">Skip (don&apos;t touch existing contacts)</option>
              </select>
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <Button
            onClick={saveSyncConfig}
            disabled={saving || !syncName.trim()}
          >
            {saving ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Sync Configuration"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
