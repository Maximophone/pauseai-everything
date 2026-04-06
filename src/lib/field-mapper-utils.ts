// Shared types and utilities for the field mapper component.
// Used by: sync-config-wizard, sync-detail, csv-importer.

export type CrmFieldDef = {
  value: string;       // e.g. "_email" or custom field name
  label: string;       // e.g. "Email"
  group: "Core" | "Special" | "Custom";
  fieldType: string;   // e.g. "text", "select", "multiselect", "date", "boolean", "number"
  options: string[] | null;
};

export type SourceField = {
  id: string;
  name: string;
  type?: string;
};

// Flat UI-friendly mapping state. Easier to manage in React than
// the discriminated-union API shape. Converted to/from API format on load/save.
export type UIMapping = {
  id: string;
  crmTarget: string;
  sourceType: "field" | "constant";
  // field source
  externalFieldId: string;
  externalFieldName: string;
  // constant source — stored as unknown to support typed values (string, number, boolean, string[], etc.)
  constantValue: unknown;
};

export const CORE_CRM_FIELDS: CrmFieldDef[] = [
  { value: "_email", label: "Email", group: "Core", fieldType: "email", options: null },
  { value: "_firstName", label: "First Name", group: "Core", fieldType: "text", options: null },
  { value: "_lastName", label: "Last Name", group: "Core", fieldType: "text", options: null },
];

export const TAGS_CRM_FIELD: CrmFieldDef = {
  value: "_tags", label: "Tags", group: "Special", fieldType: "tags", options: null,
};

export function mkId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[_\-\s]/g, "");
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
}

// Convert UIMapping → API entry for submission
export function toApiEntry(m: UIMapping): { crmTarget: string; source: unknown } | null {
  if (!m.crmTarget) return null;
  if (m.sourceType === "field") {
    if (!m.externalFieldId) return null;
    return {
      crmTarget: m.crmTarget,
      source: {
        type: "field",
        externalFieldId: m.externalFieldId,
        externalFieldName: m.externalFieldName,
      },
    };
  }
  // constant
  let value: unknown = m.constantValue;
  if (m.crmTarget === "_tags" && typeof value === "string") {
    value = value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return { crmTarget: m.crmTarget, source: { type: "constant", value } };
}

// Convert API entry → UIMapping for editing
export function entryToUIMapping(raw: unknown): UIMapping {
  const e = raw as Record<string, unknown>;

  // Backward-compat: old syncs stored flat { externalFieldId, externalFieldName, crmTarget }
  const entry = e.source !== undefined
    ? (raw as { crmTarget: string; source: { type: string; [k: string]: unknown } })
    : {
        crmTarget: e.crmTarget as string,
        source: {
          type: "field" as const,
          externalFieldId: e.externalFieldId as string,
          externalFieldName: e.externalFieldName as string,
        },
      };

  if (entry.source.type === "field") {
    return {
      id: mkId(),
      crmTarget: entry.crmTarget,
      sourceType: "field",
      externalFieldId: entry.source.externalFieldId as string,
      externalFieldName: entry.source.externalFieldName as string,
      constantValue: "",
    };
  }

  // Constant — preserve typed value
  const val = (entry.source as unknown as { value: unknown }).value;
  let constantValue: unknown = val;
  // For display in tags-like text inputs, convert arrays to comma-separated
  if (Array.isArray(val)) {
    constantValue = val;
  }
  return {
    id: mkId(),
    crmTarget: entry.crmTarget,
    sourceType: "constant",
    externalFieldId: "",
    externalFieldName: "",
    constantValue,
  };
}

// Auto-suggest mappings by fuzzy-matching source fields to CRM fields.
// Tags are skipped from auto-suggest (usually a constant, not a mapped field).
export function autoSuggestMappings(
  sourceFields: SourceField[],
  crmFields: CrmFieldDef[],
): UIMapping[] {
  const usedExternalIds = new Set<string>();
  const mappings: UIMapping[] = [];

  const crmFieldsForAutoSuggest = crmFields.filter((f) => f.group !== "Special");

  for (const crmField of crmFieldsForAutoSuggest) {
    const match = sourceFields.find(
      (ext) => !usedExternalIds.has(ext.id) && fuzzyMatch(ext.name, crmField.label)
    );
    if (match) {
      usedExternalIds.add(match.id);
      mappings.push({
        id: mkId(),
        crmTarget: crmField.value,
        sourceType: "field",
        externalFieldId: match.id,
        externalFieldName: match.name,
        constantValue: "",
      });
    }
  }
  return mappings;
}

// Create an empty mapping row
export function emptyMapping(): UIMapping {
  return {
    id: mkId(),
    crmTarget: "",
    sourceType: "field",
    externalFieldId: "",
    externalFieldName: "",
    constantValue: "",
  };
}

// Convert CSV columns into SourceField array
export function csvColumnsToSourceFields(columns: string[]): SourceField[] {
  return columns.map((col) => ({ id: col, name: col }));
}
