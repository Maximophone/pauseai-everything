"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveIcon, Trash2Icon } from "lucide-react";

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

export function ContactDetailForm({
  contact,
  fieldDefinitions,
}: {
  contact: Contact;
  fieldDefinitions: FieldDefinition[];
}) {
  const router = useRouter();
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
      {/* Core fields */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </section>

      {/* Dynamic fields */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Details</h3>
        <div className="grid grid-cols-2 gap-4">
          {fieldDefinitions.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              {renderField(field, customFields[field.name], (v) =>
                setField(field.name, v)
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <Button onClick={onSave} disabled={saving}>
          <SaveIcon className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {success && (
          <span className="text-sm text-green-600">Saved!</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <div className="ml-auto">
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2Icon className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
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

function renderField(
  field: FieldDefinition,
  value: unknown,
  onChange: (v: unknown) => void
) {
  switch (field.fieldType) {
    case "select":
      return (
        <select
          id={field.name}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        <div className="flex flex-wrap gap-1">
          {field.options?.map((opt) => (
            <label
              key={opt}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs cursor-pointer transition-colors ${
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected.includes(opt)}
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
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        />
      );

    case "date":
      return (
        <Input
          id={field.name}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );

    default:
      return (
        <Input
          id={field.name}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
  }
}
