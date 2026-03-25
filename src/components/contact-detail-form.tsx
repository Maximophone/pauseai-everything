"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHasRole } from "@/lib/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveIcon, Trash2Icon, LinkIcon } from "lucide-react";

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
  syncConfigurationId: string | null;
  syncedFields: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type SyncSource = {
  connectionId: string;
  connectionName: string;
  connectorType: string;
  syncId: string;
  syncName: string;
  lastSyncAt: string | null;
};

const CONNECTOR_LABELS: Record<string, string> = {
  airtable: "Airtable",
  notion: "Notion",
  google_sheets: "Google Sheets",
  mailchimp: "Mailchimp",
  demo: "Demo",
};

export function ContactDetailForm({
  contact,
  fieldDefinitions,
  syncSource = null,
}: {
  contact: Contact;
  fieldDefinitions: FieldDefinition[];
  syncSource?: SyncSource | null;
}) {
  const router = useRouter();
  const canEdit = useHasRole("member");
  const isAdmin = useHasRole("admin");

  // Helper: is this CRM target field locked by a sync?
  function isSynced(crmTarget: string): boolean {
    return !!contact.syncedFields?.includes(crmTarget);
  }
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [firstName, setFirstName] = useState(contact.firstName ?? "");
  const [lastName, setLastName] = useState(contact.lastName ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    contact.customFields ?? {}
  );

  function setField(name: string, value: unknown) {
    setCustomFields((prev) => ({ ...prev, [name]: value }));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          customFields,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save.");
        return;
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    setDeleting(true);
    try {
      await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      router.push("/dashboard/contacts");
      router.refresh();
    } catch {
      setError("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Sync provenance banner */}
      {contact.syncConfigurationId && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <LinkIcon className="h-4 w-4 shrink-0" />
            Synced contact
          </div>
          {syncSource ? (
            <div className="pl-6 space-y-0.5 text-blue-700">
              <div>
                <span className="text-blue-500">Connection: </span>
                <a
                  href={`/dashboard/connections/${syncSource.connectionId}`}
                  className="underline hover:text-blue-900"
                >
                  {CONNECTOR_LABELS[syncSource.connectorType] ?? syncSource.connectorType} — {syncSource.connectionName}
                </a>
              </div>
              <div>
                <span className="text-blue-500">Sync: </span>
                <a
                  href={`/dashboard/connections/${syncSource.connectionId}/syncs/${syncSource.syncId}`}
                  className="underline hover:text-blue-900"
                >
                  {syncSource.syncName}
                </a>
              </div>
              <div>
                <span className="text-blue-500">Last synced: </span>
                {syncSource.lastSyncAt
                  ? new Date(syncSource.lastSyncAt).toLocaleString()
                  : "never"}
              </div>
            </div>
          ) : null}
          <p className="pl-6 text-xs text-blue-600 pt-0.5">
            Highlighted fields are managed by the sync and cannot be edited here.
          </p>
        </div>
      )}

      {/* Core fields */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="flex items-center gap-1.5">
              First Name
              {isSynced("_firstName") && <SyncedBadge />}
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isSynced("_firstName")}
              className={isSynced("_firstName") ? "opacity-60 cursor-not-allowed" : ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="flex items-center gap-1.5">
              Last Name
              {isSynced("_lastName") && <SyncedBadge />}
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isSynced("_lastName")}
              className={isSynced("_lastName") ? "opacity-60 cursor-not-allowed" : ""}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-1.5">
            Email
            {isSynced("_email") && <SyncedBadge />}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSynced("_email")}
            className={isSynced("_email") ? "opacity-60 cursor-not-allowed" : ""}
          />
        </div>
      </section>

      {/* Dynamic fields */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Details</h3>
        <div className="grid grid-cols-2 gap-4">
          {fieldDefinitions.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.name} className="flex items-center gap-1.5">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
                {isSynced(field.name) && <SyncedBadge />}
              </Label>
              {renderField(field, customFields[field.name], (v) =>
                setField(field.name, v),
                isSynced(field.name)
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <span title={!canEdit ? "Member access required" : undefined}>
          <Button onClick={onSave} disabled={saving || !canEdit}>
            <SaveIcon className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </span>
        {success && (
          <span className="text-sm text-green-600">Saved!</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <div className="ml-auto">
          <span title={!isAdmin ? "Admin access required" : undefined}>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={deleting || !isAdmin}
            >
              <Trash2Icon className="mr-2 h-4 w-4" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground pt-2">
        Created: {new Date(contact.createdAt).toLocaleString()} | Updated:{" "}
        {new Date(contact.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function SyncedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-600 px-1.5 py-0.5 text-[10px] font-medium leading-none border border-blue-100">
      synced
    </span>
  );
}

function renderField(
  field: FieldDefinition,
  value: unknown,
  onChange: (v: unknown) => void,
  disabled = false
) {
  const disabledClass = disabled ? "opacity-60 cursor-not-allowed" : "";

  switch (field.fieldType) {
    case "select":
      return (
        <select
          id={field.name}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${disabledClass}`}
        >
          <option value="">—</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "multiselect":
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={`flex flex-wrap gap-1 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          {field.options?.map((opt) => (
            <label
              key={opt}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground border-primary"
                  : disabled ? "bg-muted" : "cursor-pointer hover:bg-muted"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected.includes(opt)}
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selected, opt]);
                  } else {
                    onChange(selected.filter((s) => s !== opt));
                  }
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case "boolean":
      return (
        <select
          id={field.name}
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) =>
            onChange(
              e.target.value === "true"
                ? true
                : e.target.value === "false"
                  ? false
                  : null
            )
          }
          disabled={disabled}
          className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${disabledClass}`}
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );

    case "number":
      return (
        <Input
          id={field.name}
          type="number"
          value={value !== null && value !== undefined ? String(value) : ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : null)
          }
          disabled={disabled}
          className={disabledClass}
        />
      );

    case "date":
      return (
        <Input
          id={field.name}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={disabledClass}
        />
      );

    default:
      return (
        <Input
          id={field.name}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={disabledClass}
        />
      );
  }
}
