"use client";

import { Input } from "@/components/ui/input";

/**
 * Type-aware value editor for CRM fields.
 * Renders the appropriate input control based on fieldType.
 * Used in: field-mapper (constant value column), contact-detail-form.
 */
export function FieldValueEditor({
  fieldType,
  options,
  value,
  onChange,
  disabled = false,
  placeholder,
}: {
  fieldType: string;
  options: string[] | null;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const disabledClass = disabled
    ? "pointer-events-none cursor-not-allowed bg-input/50 opacity-50"
    : "";
  const selectClass = `h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm ${disabledClass}`;

  switch (fieldType) {
    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={selectClass}
        >
          <option value="">—</option>
          {options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={`flex flex-wrap gap-1 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          {options?.map((opt) => (
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
          {(!options || options.length === 0) && (
            <span className="text-xs text-muted-foreground">No options defined</span>
          )}
        </div>
      );
    }

    case "boolean":
      return (
        <select
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
          className={selectClass}
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );

    case "number":
      return (
        <Input
          type="number"
          value={value !== null && value !== undefined ? String(value) : ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : null)
          }
          disabled={disabled}
          className={disabledClass || undefined}
          placeholder={placeholder}
        />
      );

    case "date":
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={disabledClass || undefined}
        />
      );

    default:
      // text, email, url, etc.
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={disabledClass || undefined}
          placeholder={placeholder}
        />
      );
  }
}
