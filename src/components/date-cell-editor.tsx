"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Popup cell editor for date fields in the contacts table.
 * Uses a native date input. Saves on change, closes on click-outside.
 */
export function DateCellEditor({
  contactId,
  fieldName,
  currentValue,
  onClose,
  onSave,
}: {
  contactId: string;
  fieldName: string;
  currentValue: string | null;
  onClose: () => void;
  onSave: (newValue: string | null) => void;
}) {
  const [value, setValue] = useState(currentValue ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function handleChange(newValue: string) {
    setValue(newValue);
    const val = newValue || null;
    onSave(val);

    await fetch(`/api/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customFields: { [fieldName]: val } }),
    });
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-56"
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Set date
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        autoFocus
      />
      {value && (
        <button
          onClick={() => handleChange("")}
          className="mt-2 text-xs text-muted-foreground hover:text-red-600 transition-colors"
        >
          Clear date
        </button>
      )}
    </div>
  );
}
