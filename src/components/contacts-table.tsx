"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const { customFields, ...rest } = contact;
  return { ...rest, ...customFields };
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

export function ContactsTable({
  initialContacts,
  fieldDefinitions,
  total,
}: {
  initialContacts: Contact[];
  fieldDefinitions: FieldDefinition[];
  total: number;
}) {
  const router = useRouter();
  const gridRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<FlatContact[]>(
    initialContacts.map(flattenContact)
  );
  const [search, setSearch] = useState("");

  const fieldNames = useMemo(
    () => fieldDefinitions.map((f) => f.name),
    [fieldDefinitions]
  );

  // Build column definitions from field definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    const coreCols: ColDef[] = [
      {
        field: "firstName",
        headerName: "First Name",
        editable: true,
        pinned: "left",
        width: 140,
      },
      {
        field: "lastName",
        headerName: "Last Name",
        editable: true,
        pinned: "left",
        width: 140,
      },
      {
        field: "email",
        headerName: "Email",
        editable: true,
        width: 220,
      },
    ];

    const customCols: ColDef[] = fieldDefinitions.map((field) => ({
      field: field.name,
      headerName: field.label,
      editable: true,
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
  }, [fieldDefinitions]);

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

  // Double-click row to navigate to detail page
  const onRowDoubleClicked = useCallback(
    (event: { data: FlatContact }) => {
      router.push(`/dashboard/contacts/${event.data.id}`);
    },
    [router]
  );

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridRef.current = event.api;
  }, []);

  // Search: refetch from server
  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("pageSize", "200");

      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setRowData(data.contacts.map(flattenContact));
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="text-sm text-muted-foreground">
          {total} contact{total !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="ag-theme-alpine" style={{ height: "calc(100vh - 260px)", width: "100%" }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          onRowDoubleClicked={onRowDoubleClicked}
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
