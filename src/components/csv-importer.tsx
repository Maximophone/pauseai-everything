"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { UploadIcon, CheckCircleIcon } from "lucide-react";

type FieldDefinition = {
  id: string;
  name: string;
  label: string;
  fieldType: string;
};

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

// Target fields for mapping
const CORE_TARGETS = [
  { value: "_email", label: "Email" },
  { value: "_firstName", label: "First Name" },
  { value: "_lastName", label: "Last Name" },
];

export function CsvImporter({
  fieldDefinitions,
}: {
  fieldDefinitions: FieldDefinition[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const allTargets = [
    ...CORE_TARGETS,
    ...fieldDefinitions.map((f) => ({ value: f.name, label: f.label })),
  ];

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];

        setCsvColumns(columns);
        setCsvRows(rows);

        // Auto-map columns by fuzzy matching labels
        const autoMapping: Record<string, string | null> = {};
        for (const col of columns) {
          const lower = col.toLowerCase().trim();
          const match = allTargets.find(
            (t) =>
              t.label.toLowerCase() === lower ||
              t.value.toLowerCase() === lower ||
              t.value === `_${lower.replace(/\s+/g, "")}`
          );
          autoMapping[col] = match?.value || null;
        }
        setMapping(autoMapping);
        setStep("mapping");
      },
    });
  }

  async function doImport() {
    setStep("importing");

    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: csvRows,
        mapping,
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
            Map each CSV column to a contact field. Unmapped columns will be
            skipped.
          </p>
        </div>

        <div className="divide-y rounded-lg border">
          {csvColumns.map((col) => (
            <div
              key={col}
              className="flex items-center justify-between px-4 py-3 gap-4"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{col}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  e.g. &quot;{csvRows[0]?.[col] || "—"}&quot;
                </span>
              </div>
              <select
                value={mapping[col] || ""}
                onChange={(e) =>
                  setMapping((prev) => ({
                    ...prev,
                    [col]: e.target.value || null,
                  }))
                }
                className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm w-48"
              >
                <option value="">— Skip —</option>
                {allTargets.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

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

        {/* Preview */}
        <div>
          <h4 className="text-sm font-medium mb-2">
            Preview (first 5 rows)
          </h4>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {Object.entries(mapping)
                    .filter(([, v]) => v)
                    .map(([col, target]) => (
                      <th key={col} className="px-3 py-2 text-left font-medium">
                        {allTargets.find((t) => t.value === target)?.label ||
                          target}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.entries(mapping)
                      .filter(([, v]) => v)
                      .map(([col]) => (
                        <td key={col} className="px-3 py-2">
                          {row[col] || "—"}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              setCsvColumns([]);
              setMapping({});
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
