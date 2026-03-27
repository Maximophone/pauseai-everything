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
  type SelectionChangedEvent,
  type IDatasource,
  type IGetRowsParams,
  type IHeaderParams,
} from "ag-grid-community";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { TagCellEditor } from "./tag-cell-editor";
import { SubscriptionCellEditor } from "./subscription-cell-editor";
import { useWorkspaceId } from "@/components/workspace-provider";

ModuleRegistry.registerModules([AllCommunityModule]);

// Header checkbox for Infinite Row Model (AG Grid doesn't support headerCheckbox
// in this row model, so we implement it manually with a custom header component).
function SelectPageHeaderCheckbox(params: IHeaderParams) {
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);

  const updateState = useCallback(() => {
    const api = params.api;
    const currentPage = api.paginationGetCurrentPage();
    const pageSize = api.paginationGetPageSize();
    const startRow = currentPage * pageSize;
    const endRow = startRow + pageSize;
    let selected = 0;
    let total = 0;
    api.forEachNode((node) => {
      if (node.rowIndex !== null && node.rowIndex >= startRow && node.rowIndex < endRow) {
        total++;
        if (node.isSelected()) selected++;
      }
    });
    setChecked(total > 0 && selected === total);
    setIndeterminate(selected > 0 && selected < total);
  }, [params.api]);

  useEffect(() => {
    params.api.addEventListener("selectionChanged", updateState);
    params.api.addEventListener("paginationChanged", updateState);
    return () => {
      params.api.removeEventListener("selectionChanged", updateState);
      params.api.removeEventListener("paginationChanged", updateState);
    };
  }, [params.api, updateState]);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const handleChange = () => {
    const api = params.api;
    const currentPage = api.paginationGetCurrentPage();
    const pageSize = api.paginationGetPageSize();
    const startRow = currentPage * pageSize;
    const endRow = startRow + pageSize;
    const shouldSelect = !checked && !indeterminate;
    api.forEachNode((node) => {
      if (node.rowIndex !== null && node.rowIndex >= startRow && node.rowIndex < endRow) {
        node.setSelected(shouldSelect);
      }
    });
  };

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={handleChange}
      style={{ cursor: "pointer", accentColor: "var(--primary)" }}
      aria-label="Select all on page"
    />
  );
}

const BLOCK_SIZE = 200;

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
  syncConfigurationId: string | null;
  syncedFields: string[] | null;
  tags: string[];
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
  _syncConfigurationId: string | null;
  _syncedFields: string[] | null;
  _tags: string[];
  _commPrefs: Record<string, "subscribed" | "unsubscribed">;
  [key: string]: unknown;
};

function flattenContact(contact: Contact): FlatContact {
  const { customFields, communicationPreferences, syncConfigurationId, syncedFields, tags, ...rest } = contact;
  return {
    ...rest,
    ...customFields,
    _commPrefs: communicationPreferences || {},
    _syncConfigurationId: syncConfigurationId ?? null,
    _syncedFields: syncedFields ?? null,
    _tags: tags || [],
  };
}

function isSyncedField(data: FlatContact | undefined, fieldName: string): boolean {
  if (!data) return false;
  const syncedFields = data._syncedFields as string[] | null;
  if (!syncedFields) return false;
  const crmTarget = fieldName === "email" ? "_email" : fieldName;
  return syncedFields.includes(crmTarget);
}

function unflattenContact(
  flat: FlatContact,
  fieldNames: string[]
): { firstName: string | null; lastName: string | null; email: string | null; customFields: Record<string, unknown> } {
  const customFields: Record<string, unknown> = {};
  for (const name of fieldNames) {
    if (flat[name] !== undefined) customFields[name] = flat[name];
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
    case "number": return "numericColumn";
    case "date": return "dateColumn";
    default: return "text";
  }
}

function getCellEditor(field: FieldDefinition): Partial<ColDef> {
  if (field.fieldType === "select" && field.options)
    return { cellEditor: "agSelectCellEditor", cellEditorParams: { values: field.options } };
  if (field.fieldType === "boolean")
    return { cellEditor: "agSelectCellEditor", cellEditorParams: { values: [true, false] } };
  if (field.fieldType === "number")
    return { cellEditor: "agNumberCellEditor" };
  return {};
}

function NameCellRenderer(params: { data: FlatContact; value: string }) {
  const router = useRouter();
  if (!params.data) return params.value;
  const isSynced = !!params.data._syncConfigurationId;
  return (
    <div className="flex items-center gap-1.5 h-full">
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
      {isSynced && (
        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-600 px-1.5 py-0.5 text-[10px] font-medium leading-none border border-blue-100 shrink-0">
          synced
        </span>
      )}
    </div>
  );
}

type Category = { id: string; name: string; label: string; workspaceId?: string | null };

export function ContactsTable({
  fieldDefinitions,
  categories = [],
}: {
  fieldDefinitions: FieldDefinition[];
  categories?: Category[];
}) {
  const router = useRouter();
  const canEdit = useHasRole("member");
  const isAdmin = useHasRole("admin");
  const workspaceId = useWorkspaceId();
  const gridRef = useRef<GridApi | null>(null);

  // Build workspace-namespaced preference key (matches subscription-cell-editor.tsx)
  function catPrefKey(cat: Category): string {
    const wsId = cat.workspaceId ?? workspaceId;
    return wsId ? `${wsId}:${cat.name}` : cat.name;
  }

  // Search is read inside the datasource via ref to keep the datasource stable
  const searchRef = useRef("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [editingTagsFor, setEditingTagsFor] = useState<{ contactId: string; rect: DOMRect } | null>(null);
  const [editingSubsFor, setEditingSubsFor] = useState<{ contactId: string; rect: DOMRect } | null>(null);

  // Stable datasource — reads search from ref, refreshed explicitly when search changes
  const datasource: IDatasource = useMemo(() => ({
    getRows: async (params: IGetRowsParams) => {
      const { startRow, endRow, sortModel } = params;
      const pageSize = endRow - startRow;
      const page = Math.floor(startRow / pageSize) + 1;

      const urlParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (searchRef.current) urlParams.set("search", searchRef.current);

      // Map AG Grid sort model → API params (only supported fields)
      const sortMap: Record<string, string> = { firstName: "firstName", email: "email", createdAt: "createdAt" };
      if (sortModel?.length > 0) {
        const s = sortModel[0];
        const sortBy = sortMap[s.colId];
        if (sortBy) {
          urlParams.set("sortBy", sortBy);
          urlParams.set("sortOrder", s.sort as string);
        }
      }

      try {
        const res = await fetch(`/api/contacts?${urlParams}`);
        if (!res.ok) { params.failCallback(); return; }
        const data = await res.json() as { contacts: Contact[]; total: number };
        setTotal(data.total);
        params.successCallback(data.contacts.map(flattenContact), data.total);
      } catch {
        params.failCallback();
      }
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // When search changes: update ref, then refresh the infinite cache
  useEffect(() => {
    searchRef.current = search;
    gridRef.current?.refreshInfiniteCache();
  }, [search]);

  // Refresh grid when contacts are added/modified externally
  useEffect(() => {
    const handler = () => gridRef.current?.refreshInfiniteCache();
    window.addEventListener("contacts-changed", handler);
    return () => window.removeEventListener("contacts-changed", handler);
  }, []);

  const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const selected = event.api.getSelectedRows() as FlatContact[];
    setSelectedIds(selected.map((r) => r.id));
  }, []);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} contact${selectedIds.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
      const res = await fetch("/api/contacts", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        gridRef.current?.deselectAll();
        setSelectedIds([]);
        gridRef.current?.refreshInfiniteCache();
      }
    } finally {
      setDeleting(false);
    }
  }, [selectedIds]);

  const fieldNames = useMemo(() => fieldDefinitions.map((f) => f.name), [fieldDefinitions]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const checkboxCol: ColDef = {
      colId: "_checkbox",
      headerComponent: SelectPageHeaderCheckbox,
      checkboxSelection: true,
      pinned: "left",
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      resizable: false,
      sortable: false,
      filter: false,
      editable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    };

    const coreCols: ColDef[] = [
      {
        colId: "firstName",
        headerName: "Name",
        pinned: "left",
        width: 200,
        sortable: true,
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
        sortable: true,
        editable: canEdit
          ? (params: { data: FlatContact | undefined }) => !isSyncedField(params.data, "email")
          : false,
        width: 220,
        cellStyle: (params: { data: FlatContact | undefined }) =>
          isSyncedField(params.data, "email")
            ? { color: "var(--muted-foreground)", fontStyle: "italic" }
            : null,
      },
      {
        field: "_tags",
        headerName: "Tags",
        editable: false,
        sortable: false,
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
              {tagList.length === 0
                ? canEdit ? <span className="text-xs text-muted-foreground">+ Add tags</span> : null
                : tagList.map((tag: string) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                    {tag}
                  </span>
                ))}
            </div>
          );
        },
      },
      {
        field: "_commPrefs",
        headerName: "Subscriptions",
        editable: false,
        sortable: false,
        width: Math.max(180, categories.length * 90),
        valueGetter: (params: { data: FlatContact }) =>
          (params.data?._commPrefs || {}) as Record<string, "subscribed" | "unsubscribed">,
        valueFormatter: (params: { value: unknown }) => {
          const prefs = (params.value || {}) as Record<string, "subscribed" | "unsubscribed">;
          return categories.map((c) => prefs[catPrefKey(c)] ? `${c.label}: ${prefs[catPrefKey(c)]}` : "").filter(Boolean).join(", ") || "";
        },
        cellRenderer: (params: { value: unknown; data: FlatContact; eGridCell: HTMLElement }) => {
          const prefs = (params.value || {}) as Record<string, "subscribed" | "unsubscribed">;
          const handleClick = () => {
            if (!canEdit || !params.eGridCell) return;
            const rect = params.eGridCell.getBoundingClientRect();
            setEditingSubsFor({ contactId: params.data.id, rect });
          };
          if (categories.length === 0) return <span className="text-xs text-gray-400">No categories</span>;
          const hasAnyPref = categories.some((c) => prefs[catPrefKey(c)]);
          return (
            <div
              className={`flex gap-1 flex-wrap items-center h-full ${canEdit ? "cursor-pointer" : ""}`}
              onClick={handleClick}
            >
              {!hasAnyPref
                ? <span className="text-xs text-gray-400">{canEdit ? "Click to set" : "—"}</span>
                : categories.map((cat) => {
                  const status = prefs[catPrefKey(cat)];
                  if (!status) return null;
                  return (
                    <span key={cat.name} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status === "subscribed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {cat.label}
                    </span>
                  );
                })}
            </div>
          );
        },
      },
    ];

    const customCols: ColDef[] = fieldDefinitions.map((field) => ({
      field: field.name,
      headerName: field.label,
      sortable: false,
      editable: field.fieldType === "multiselect"
        ? false
        : canEdit
          ? (params: { data: FlatContact | undefined }) => !isSyncedField(params.data, field.name)
          : false,
      type: getColumnType(field.fieldType),
      width: 150,
      ...getCellEditor(field),
      cellStyle: (params: { data: FlatContact | undefined }) =>
        isSyncedField(params.data, field.name)
          ? { color: "var(--muted-foreground)", fontStyle: "italic" }
          : null,
      ...(field.fieldType === "multiselect" && {
        valueFormatter: (params: { value: unknown }) =>
          Array.isArray(params.value) ? params.value.join(", ") : "",
      }),
    }));

    const metaCols: ColDef[] = [{
      field: "createdAt",
      colId: "createdAt",
      headerName: "Created",
      sortable: true,
      editable: false,
      width: 160,
      valueFormatter: (params: { value: unknown }) =>
        params.value ? new Date(params.value as string).toLocaleDateString() : "",
    }];

    return [checkboxCol, ...coreCols, ...customCols, ...metaCols];
  }, [fieldDefinitions, canEdit, categories, workspaceId]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: false,
    filter: false,
    resizable: true,
  }), []);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
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
    }
  }, [fieldNames]);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridRef.current = event.api;
  }, []);

  // Export: fetch all matching contacts server-side for a complete CSV
  const exportCsv = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: "100000" });
    if (searchRef.current) params.set("search", searchRef.current);
    const res = await fetch(`/api/contacts?${params}`);
    if (!res.ok) return;
    const { contacts: rows } = await res.json() as { contacts: Contact[] };

    // Build CSV manually so we always export the full set
    const headers = ["id", "email", "firstName", "lastName", ...fieldDefinitions.map((f) => f.name), "createdAt"];
    const csvRows = [
      headers.join(","),
      ...rows.map((c) => headers.map((h) => {
        const v = h === "firstName" ? c.firstName
          : h === "lastName" ? c.lastName
          : h === "email" ? c.email
          : h === "id" ? c.id
          : h === "createdAt" ? c.createdAt
          : c.customFields[h];
        return v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pauseai-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fieldDefinitions]);

  // Get current prefs for the subscription editor from the row node
  const editingSubsPrefs = editingSubsFor
    ? ((gridRef.current?.getRowNode(editingSubsFor.contactId)?.data?._commPrefs ?? {}) as Record<string, "subscribed" | "unsubscribed">)
    : {};

  // Get current tags for the tag editor from the row node
  const editingTagsCurrent = editingTagsFor
    ? ((gridRef.current?.getRowNode(editingTagsFor.contactId)?.data?._tags ?? []) as string[])
    : [];

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Tag editor popup */}
      {editingTagsFor && (
        <div style={{ position: "fixed", top: editingTagsFor.rect.bottom + 4, left: editingTagsFor.rect.left, zIndex: 100 }}>
          <TagCellEditor
            contactId={editingTagsFor.contactId}
            currentTags={editingTagsCurrent}
            onClose={() => setEditingTagsFor(null)}
            onSave={(newTags) => {
              const node = gridRef.current?.getRowNode(editingTagsFor.contactId);
              if (node) node.setData({ ...node.data, _tags: newTags });
            }}
          />
        </div>
      )}

      {/* Subscription editor popup */}
      {editingSubsFor && (
        <div style={{ position: "fixed", top: editingSubsFor.rect.bottom + 4, left: editingSubsFor.rect.left, zIndex: 100 }}>
          <SubscriptionCellEditor
            contactId={editingSubsFor.contactId}
            currentPrefs={editingSubsPrefs}
            onClose={() => setEditingSubsFor(null)}
            onSave={(newPrefs) => {
              const node = gridRef.current?.getRowNode(editingSubsFor.contactId);
              if (node) node.setData({ ...node.data, _commPrefs: newPrefs });
            }}
          />
        </div>
      )}

      {/* Toolbar */}
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
            {total === null ? "Loading…" : `${total.toLocaleString()} contact${total !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* Contextual action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2">
          <span className="text-sm font-medium text-red-800">
            {selectedIds.length} contact{selectedIds.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => { gridRef.current?.deselectAll(); setSelectedIds([]); }}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            Clear selection
          </button>
          {isAdmin && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting…" : `Delete ${selectedIds.length}`}
            </button>
          )}
        </div>
      )}

      <div className="ag-theme-alpine" style={{ height: "calc(100vh - 260px)", width: "100%" }}>
        <AgGridReact
          rowModelType="infinite"
          datasource={datasource}
          getRowId={(params) => params.data.id}
          cacheBlockSize={BLOCK_SIZE}
          maxBlocksInCache={50}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          rowSelection="multiple"
          suppressRowClickSelection
          animateRows
          pagination
          paginationPageSize={50}
        />
      </div>
    </div>
  );
}
