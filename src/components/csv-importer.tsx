"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { UploadIcon, CheckCircleIcon } from "lucide-react";
import { FieldMapper } from "@/components/field-mapper";
import { useCrmFields } from "@/lib/hooks/use-crm-fields";
import {
  autoSuggestMappings,
  csvColumnsToSourceFields,
  toApiEntry,
  type SourceField,
  type UIMapping,
} from "@/lib/field-mapper-utils";

type Step = "upload" | "mapping" | "importing" | "done";

export function CsvImporter() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { crmFields } = useCrmFields();

  const [step, setStep] = useState<Step>("upload");
  const [sourceFields, setSourceFields] = useState<SourceField[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<UIMapping[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];

        setCsvRows(rows);
        const fields = csvColumnsToSourceFields(columns);
        setSourceFields(fields);

        // Auto-suggest mappings using shared logic
        setMappings(autoSuggestMappings(fields, crmFields));
        setStep("mapping");
      },
    });
  }

  async function doImport() {
    setStep("importing");

    // Convert UIMapping[] to the flat Record<string, string> that the API expects,
    // plus collect constant values to inject into each row.
    const fieldMappingRecord: Record<string, string> = {};
    const constantValues: Record<string, unknown> = {};

    for (const m of mappings) {
      if (!m.crmTarget) continue;
      const entry = toApiEntry(m);
      if (!entry) continue;

      if (m.sourceType === "field" && m.externalFieldId) {
        // CSV column name → CRM target
        fieldMappingRecord[m.externalFieldId] = m.crmTarget;
      } else if (m.sourceType === "constant") {
        constantValues[m.crmTarget] = (entry.source as { value: unknown }).value;
      }
    }

    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: csvRows,
        mapping: fieldMappingRecord,
        constantValues,
        skipDuplicates,
      }),
    });

    const data = await res.json();
    setResult(data);
    setStep("done");
  }

  // ── Upload step ──
  if (step === "upload") {
    return (
      <div
        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">
          Click to upload a CSV file
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The first row should contain column headers
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>
    );
  }

  // ── Mapping step ──
  if (step === "mapping") {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">
            Map columns ({csvRows.length} rows found)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            For each CRM field, choose a CSV column to import from, or set a fixed value
            applied to every imported record (e.g. tags).
          </p>
        </div>

        <FieldMapper
          mappings={mappings}
          onChange={setMappings}
          crmFields={crmFields}
          sourceFields={sourceFields}
          sourceFieldLabel="CSV column"
          previewRows={csvRows}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skipDuplicates"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
          />
          <label htmlFor="skipDuplicates" className="text-sm">
            Skip rows where email already exists in the system
          </label>
        </div>

        <div className="flex gap-2">
          <Button onClick={doImport}>
            Import {csvRows.length} contacts
          </Button>
          <Button variant="outline" onClick={() => setStep("upload")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Importing step ──
  if (step === "importing") {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium">Importing...</p>
        <p className="text-sm text-muted-foreground mt-1">
          Processing {csvRows.length} rows
        </p>
      </div>
    );
  }

  // ── Done step ──
  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold">Import Complete</h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold">{result.total}</div>
            <div className="text-sm text-muted-foreground">Total rows</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold text-green-600">
              {result.created}
            </div>
            <div className="text-sm text-muted-foreground">Created</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {result.updated}
            </div>
            <div className="text-sm text-muted-foreground">Updated</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-2xl font-bold text-gray-400">
              {result.skipped}
            </div>
            <div className="text-sm text-muted-foreground">Skipped</div>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="rounded-lg border border-red-200 p-4">
            <h4 className="text-sm font-medium text-red-600 mb-2">
              Errors ({result.errors.length})
            </h4>
            <ul className="text-sm space-y-1">
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => router.push("/dashboard/contacts")}>
            View Contacts
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStep("upload");
              setResult(null);
              setCsvRows([]);
              setSourceFields([]);
              setMappings([]);
            }}
          >
            Import Another File
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
