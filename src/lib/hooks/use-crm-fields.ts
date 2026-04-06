"use client";

import { useEffect, useState } from "react";
import { CORE_CRM_FIELDS, TAGS_CRM_FIELD, type CrmFieldDef } from "@/lib/field-mapper-utils";

/**
 * Fetches CRM field definitions from the API and returns
 * the full list (core + tags + custom fields) with type metadata.
 */
export function useCrmFields(): { crmFields: CrmFieldDef[]; loading: boolean } {
  const [crmFields, setCrmFields] = useState<CrmFieldDef[]>([
    ...CORE_CRM_FIELDS,
    TAGS_CRM_FIELD,
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/fields");
        if (res.ok) {
          const fields = (await res.json()) as {
            name: string;
            label: string;
            fieldType: string;
            options: string[] | null;
          }[];
          setCrmFields([
            ...CORE_CRM_FIELDS,
            TAGS_CRM_FIELD,
            ...fields.map((f) => ({
              value: f.name,
              label: f.label,
              group: "Custom" as const,
              fieldType: f.fieldType,
              options: f.options,
            })),
          ]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { crmFields, loading };
}
