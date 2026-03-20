"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHasRole } from "@/lib/hooks/use-user-role";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellValueChangedEvent,
  type GridReadyEvent,
  type GridApi,
} from "ag-grid-community";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { TagCellEditor } from "./tag-cell-editor";
import { SubscriptionCellEditor } from "./subscription-cell-editor";

ModuleRegistry.registerModules([AllCommunityModule]);

type FieldDefinition = {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: string[] | null;
  required: boolean;
  sortOrder: number;
};

type Contact = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customFields: Record<string, unknown>;
  communicationPreferences: Record<string, "subscribed" | "unsubscribed">;
  createdAt: string;
  updatedAt: string;
};

type FlatContact = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

// Flatten customFields into top-level for AG Grid
function flattenContact(contact: Contact): FlatContact {
  const { customFields, communicationPreferences, ...rest } = contact;
  return { ...rest, ...customFields, _commPrefs: communicationPreferences || {} };
}

// Reconstruct contact from flat row
function unflattenContact(
  flat: FlatContact,
  fieldNames: string[]
): { firstName: string | null; lastName: string | null; email: string | null; customFields: Record<string, unknown> } {
  const customFields: Record<string, unknown> = {};
  for (const name of fieldNames) {
    if (flat[name] !== undefined) {
      customFields[name] = flat[name];
    }
  }
  return {
    firstName: flat.firstName as string | null,
    lastName: flat.lastName as string | null,
    email: flat.email as string | null,
    customFields,
  };
}

function getColumnType(fieldType: string): string {
  switch (fieldType) {
    case "number":
      return "numericColumn";
    case "date":
      return "dateColumn";
    default:
      return "text";
  }
}

function getCellEditor(field: FieldDefinition): Partial<ColDef> {
  if (field.fieldType === "select" && field.options) {
    return {
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: field.options },
    };
  }
  if (field.fieldType === "boolean") {
    return {
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: [true, false] },
    };
  }
  if (field.fieldType === "number") {
    return { cellEditor: "agNumberCellEditor" };
  }
  return {};
}

function NameCellRenderer(params: { data: FlatContact; value: string }) {
  const router = useRouter();
  if (!params.data) return params.value;
  return (
    <a
      href={`/dashboard/contacts/${params.data.id}`}
      onClick={(e) => {
        e.preventDefault();
        router.push(`/dashboard/contacts/${params.data.id}`);
      }}
      className="text-blue-600 underline cursor-pointer"
    >
      {params.value}
    </a>
  );
}

type Category = {
  id: string;
  name: string;
  label: string;
};

export function ContactsTable({
  initialContacts,
  fieldDefinitions,
  total,
  initialTagsMap = {},
  categories = [],
}: {
  initialContacts: Contact[];
  fieldDefinitions: FieldDefinition[];
  total: number;
  initialTagsMap?: Record<string, string[]>;
  categories?: Category[];
}) {
  const router = useRouter();
  const canEdit = useHasRole("member");
  const gridRef = useRef<GridApi | null>(null);
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>(initialTagsMap);
  const [rowData, setRowData] = useState<FlatContact[]>(
    initialContacts.map((c) => ({ ...flattenContact(c), _tags: initialTagsMap[c.id] || [] }))
  );
  const [search, setSearch] = useState("");
  const [editingTagsFor, setEditingTagsFor] = useState<{ contactId: string; rect: DOMRect } | null>(null);
  const [editingSubsFor, setEditingSubsFor] = useState<{ contactId: string; rect: DOMRect } | null>(null);

  // Sync rowData when server re-renders with new initialContacts
  useEffect(() => {
    setRowData(initialContacts.map((c) => ({ ...flattenContact(c), _tags: initialTagsMap[c.id] || [] })));
    setTagsMap(initialTagsMap);
  }, [initialContacts, initialTagsMap]);

  const fieldNames = useMemo(
    () => fieldDefinitions.map((f) => f.name),
    [fieldDefinitions]
  );

  // Build column definitions from field definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    const coreCols: ColDef[] = [
      {
        headerName: "Name",
        pinned: "left",
        width: 200,
        editable: false,
        valueGetter: (params: { data: FlatContact }) => {
          const first = params.data?.firstName ?? "";
          const last = params.data?.lastName ?? "";
          return `${first} ${last}`.trim() || "Unnamed";
        },
        cellRenderer: NameCellRenderer,
      },
      {
        field: "email",
        headerName: "Email",
        editable: canEdit,
        width: 220,
      },
      {
        field: "_tags",
        headerName: "Tags",
        editable: false,
        width: 180,
        valueFormatter: (params: { value: unknown }) =>
          Array.isArray(params.value) ? params.value.join(", ") : "",
        cellRenderer: (params: { value: unknown; data: FlatContact; eGridCell: HTMLElement }) => {
          const tagList = Array.isArray(params.value) ? params.value : [];
          const handleClick = () => {
            if (!canEdit || !params.eGridCell) return;
            const rect = params.eGridCell.getBoundingClientRect();
            setEditingTagsFor({ contactId: params.data.id, rect });
          };
          return (
            <div
              className={`flex gap-1 flex-wrap items-center h-full ${canEdit ? "cursor-pointer" : ""}`}
              onClick={handleClick}
            >
              {tagList.length === 0 ? (
                canEdit ? (
                  <span className="text-xs text-muted-foreground">+ Add tags</span>
                ) : null
              ) : (
                tagList.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          );
        },
      },
      {
        field: "_commPrefs",
        headerName: "Subscriptions",
        editable: false,
        width: Math.max(180, categories.length * 90),
        valueGetter: (params: { data: FlatContact }) => {
          return (params.data?._commPrefs || {}) as Record<string, "subscribed" | "unsubscribed">;
        },
        valueFormatter: (params: { value: unknown }) => {
          const prefs = (params.value || {}) as Record<string, "subscribed" | "unsubscribed">;
          return categories
            .map((c) => {
              const s = prefs[c.name];
              return s ? `${c.label}: ${s}` : "";
            })
            .filter(Boolean)
            .join(", ") || "";
        },
        cellRenderer: (params: { value: unknown; data: FlatContact; eGridCell: HTMLElement }) => {
          const prefs = (params.value || {}) as Record<string, "subscribed" | "unsubscribed">;
          const handleClick = () => {
            if (!canEdit || !params.eGridCell) return;
            const rect = params.eGridCell.getBoundingClientRect();
            setEditingSubsFor({ contactId: params.data.id, rect });
          };

          if (categories.length === 0) {
            return <span className="text-xs text-gray-400">No categories</span>;
          }

          const hasAnyPref = categories.some((c) => prefs[c.name]);

          return (
            <div
              className={`flex gap-1 flex-wrap items-center h-full ${canEdit ? "cursor-pointer" : ""}`}
              onClick={handleClick}
            >
              {!hasAnyPref ? (
                <span className="text-xs text-gray-400">
                  {canEdit ? "Click to set" : "—"}
                </span>
              ) : (
                categories.map((cat) => {
                  const status = prefs[cat.name];
                  if (!status) return null; // neutral — don't show
                  return (
                    <span
                      key={cat.name}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        status === "subscribed"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {cat.label}
                    </span>
                  );
                })
              )}
            </div>
          );
        },
      },
    ];

    const customCols: ColDef[] = fieldDefinitions.map((field) => ({
      field: field.name,
      headerName: field.label,
      editable: canEdit,
      type: getColumnType(field.fieldType),
      width: 150,
      ...getCellEditor(field),
      // For multiselect, show as comma-separated
      ...(field.fieldType === "multiselect" && {
        valueFormatter: (params: { value: unknown }) =>
          Array.isArray(params.value) ? params.value.join(", ") : "",
        editable: false, // multiselect needs a custom editor — disable inline for now
      }),
    }));

    const metaCols: ColDef[] = [
      {
        field: "createdAt",
        headerName: "Created",
        editable: false,
        width: 160,
        valueFormatter: (params: { value: unknown }) =>
          params.value
            ? new Date(params.value as string).toLocaleDateString()
            : "",
      },
    ];

    return [...coreCols, ...customCols, ...metaCols];
  }, [fieldDefinitions, canEdit, categories]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    []
  );

  // Handle inline cell edit
  const onCellValueChanged = useCallback(
    async (event: CellValueChangedEvent) => {
      const row = event.data as FlatContact;
      const contactData = unflattenContact(row, fieldNames);

      try {
        await fetch(`/api/contacts/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactData),
        });
      } catch (err) {
        console.error("Failed to save:", err);
        // TODO: show error toast and revert
      }
    },
    [fieldNames]
  );

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridRef.current = event.api;
  }, []);

  const exportCsv = useCallback(() => {
    gridRef.current?.exportDataAsCsv({
      fileName: `pauseai-contacts-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  }, []);

  // Search: refetch from server
  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("pageSize", "200");

      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      // Fetch tags for these contacts
      const ids = data.contacts.map((c: Contact) => c.id);
      let newTagsMap: Record<string, string[]> = {};
      if (ids.length > 0) {
        const tagsRes = await fetch(`/api/contacts/tags?ids=${ids.join(",")}`);
        if (tagsRes.ok) newTagsMap = await tagsRes.json();
      }
      setTagsMap(newTagsMap);
      setRowData(data.contacts.map((c: Contact) => ({ ...flattenContact(c), _tags: newTagsMap[c.id] || [] })));
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Get current prefs for the editing contact
  const editingSubsPrefs = editingSubsFor
    ? ((rowData.find((r) => r.id === editingSubsFor.contactId)?._commPrefs || {}) as Record<string, "subscribed" | "unsubscribed">)
    : {};

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Tag editor popup */}
      {editingTagsFor && (
        <div
          style={{
            position: "fixed",
            top: editingTagsFor.rect.bottom + 4,
            left: editingTagsFor.rect.left,
            zIndex: 100,
          }}
        >
          <TagCellEditor
            contactId={editingTagsFor.contactId}
            currentTags={
              (rowData.find((r) => r.id === editingTagsFor.contactId)?._tags as string[]) || []
            }
            onClose={() => setEditingTagsFor(null)}
            onSave={(newTags) => {
              setRowData((prev) =>
                prev.map((r) =>
                  r.id === editingTagsFor.contactId ? { ...r, _tags: newTags } : r
                )
              );
            }}
          />
        </div>
      )}

      {/* Subscription editor popup */}
      {editingSubsFor && (
        <div
          style={{
            position: "fixed",
            top: editingSubsFor.rect.bottom + 4,
            left: editingSubsFor.rect.left,
            zIndex: 100,
          }}
        >
          <SubscriptionCellEditor
            contactId={editingSubsFor.contactId}
            currentPrefs={editingSubsPrefs}
            onClose={() => setEditingSubsFor(null)}
            onSave={(newPrefs) => {
              setRowData((prev) =>
                prev.map((r) =>
                  r.id === editingSubsFor.contactId ? { ...r, _commPrefs: newPrefs } : r
                )
              );
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <span className="text-sm text-muted-foreground">
            {total} contact{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="ag-theme-alpine" style={{ height: "calc(100vh - 260px)", width: "100%" }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          onGridReady={onGridReady}
          rowSelection="multiple"
          animateRows
          pagination
          paginationPageSize={50}
        />
      </div>
    </div>
  );
}
