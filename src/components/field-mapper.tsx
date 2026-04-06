"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon, XIcon } from "lucide-react";
import { FieldValueEditor } from "@/components/field-value-editor";
import { emptyMapping, type CrmFieldDef, type SourceField, type UIMapping } from "@/lib/field-mapper-utils";

/**
 * Shared field mapper component used by:
 * - sync-config-wizard (step 2)
 * - sync-detail (edit mode)
 * - csv-importer (mapping step)
 *
 * Props:
 * - mappings / onChange: controlled UIMapping[] state
 * - crmFields: available CRM field definitions (with type metadata)
 * - sourceFields: available external / CSV column fields
 * - previewRows: optional CSV preview data (first N rows)
 * - sourceFieldLabel: label for the source dropdown (default "External field")
 * - showSourceType: whether to show the Field/Fixed toggle (default true)
 * - error: optional error message
 */
export function FieldMapper({
  mappings,
  onChange,
  crmFields,
  sourceFields,
  previewRows,
  sourceFieldLabel = "External field",
  showSourceType = true,
  error,
}: {
  mappings: UIMapping[];
  onChange: (mappings: UIMapping[]) => void;
  crmFields: CrmFieldDef[];
  sourceFields: SourceField[];
  previewRows?: Record<string, string>[];
  sourceFieldLabel?: string;
  showSourceType?: boolean;
  error?: string | null;
}) {
  const usedCrmTargets = new Set(mappings.map((m) => m.crmTarget).filter(Boolean));

  function updateMapping(id: string, patch: Partial<UIMapping>) {
    onChange(mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeMapping(id: string) {
    onChange(mappings.filter((m) => m.id !== id));
  }

  function addMapping() {
    onChange([...mappings, emptyMapping()]);
  }

  // Group CRM fields for optgroup rendering
  const coreFields = crmFields.filter((f) => f.group === "Core");
  const specialFields = crmFields.filter((f) => f.group === "Special");
  const customFields = crmFields.filter((f) => f.group === "Custom");

  // Resolve CRM field def for a mapping (for type-aware constant editor)
  function getCrmFieldDef(crmTarget: string): CrmFieldDef | undefined {
    return crmFields.find((f) => f.value === crmTarget);
  }

  // Determine the effective constant placeholder for a mapping
  function getConstantPlaceholder(m: UIMapping): string {
    if (m.crmTarget === "_tags") return "e.g. volunteer, csv-import";
    return "Fixed value\u2026";
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border divide-y">
        {/* Column headers */}
        <div className={`grid ${showSourceType ? "grid-cols-[1fr_auto_1fr_32px]" : "grid-cols-[1fr_1fr_32px]"} gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground`}>
          <div>CRM Field</div>
          {showSourceType && <div />}
          <div>Source</div>
          <div />
        </div>

        {mappings.length === 0 && (
          <div className="px-4 py-6 text-sm text-center text-muted-foreground">
            No mappings yet — add one below.
          </div>
        )}

        {mappings.map((m) => {
          const crmDef = getCrmFieldDef(m.crmTarget);
          return (
            <div key={m.id} className={`grid ${showSourceType ? "grid-cols-[1fr_auto_1fr_32px]" : "grid-cols-[1fr_1fr_32px]"} gap-3 px-4 py-2 items-center`}>

              {/* CRM target */}
              <select
                value={m.crmTarget}
                onChange={(e) => updateMapping(m.id, { crmTarget: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                <option value="">— CRM field —</option>
                {coreFields.length > 0 && (
                  <optgroup label="Core">
                    {coreFields.map((f) => (
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
                {specialFields.length > 0 && (
                  <optgroup label="Special">
                    {specialFields.map((f) => (
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
                {customFields.length > 0 && (
                  <optgroup label="Custom Fields">
                    {customFields.map((f) => (
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
              {showSourceType && (
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
              )}

              {/* Source value */}
              {m.sourceType === "field" ? (
                <select
                  value={m.externalFieldId}
                  onChange={(e) => {
                    const ext = sourceFields.find((f) => f.id === e.target.value);
                    updateMapping(m.id, {
                      externalFieldId: ext?.id || "",
                      externalFieldName: ext?.name || "",
                    });
                  }}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                >
                  <option value="">— {sourceFieldLabel} —</option>
                  {sourceFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}{f.type ? ` (${f.type})` : ""}
                    </option>
                  ))}
                </select>
              ) : crmDef && (crmDef.fieldType === "select" || crmDef.fieldType === "multiselect" || crmDef.fieldType === "boolean" || crmDef.fieldType === "number" || crmDef.fieldType === "date" || crmDef.fieldType === "tags") ? (
                <FieldValueEditor
                  fieldType={crmDef.fieldType}
                  options={crmDef.options}
                  value={m.constantValue}
                  onChange={(v) => updateMapping(m.id, { constantValue: v })}
                  placeholder={getConstantPlaceholder(m)}
                />
              ) : (
                // Text input fallback for text/email/url/tags and unknown types
                <input
                  value={typeof m.constantValue === "string" ? m.constantValue : Array.isArray(m.constantValue) ? (m.constantValue as string[]).join(", ") : String(m.constantValue ?? "")}
                  onChange={(e) => updateMapping(m.id, { constantValue: e.target.value })}
                  placeholder={getConstantPlaceholder(m)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
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
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={addMapping}>
        <PlusIcon className="mr-1 h-3 w-3" />
        Add mapping
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Preview table (for CSV imports) */}
      {previewRows && previewRows.length > 0 && mappings.some((m) => m.crmTarget && m.sourceType === "field" && m.externalFieldId) && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            Preview (first {Math.min(previewRows.length, 5)} rows)
          </h4>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {mappings
                    .filter((m) => m.crmTarget && m.sourceType === "field" && m.externalFieldId)
                    .map((m) => (
                      <th key={m.id} className="px-3 py-2 text-left font-medium">
                        {crmFields.find((f) => f.value === m.crmTarget)?.label || m.crmTarget}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {mappings
                      .filter((m) => m.crmTarget && m.sourceType === "field" && m.externalFieldId)
                      .map((m) => (
                        <td key={m.id} className="px-3 py-2">
                          {row[m.externalFieldId] || "\u2014"}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
