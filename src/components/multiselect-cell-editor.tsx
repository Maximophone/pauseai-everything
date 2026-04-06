"use client";

import { useState, useEffect, useRef } from "react";
import { XIcon } from "lucide-react";

/**
 * Popup cell editor for multiselect fields in the contacts table.
 * Follows the same pattern as TagCellEditor: positioned as a fixed popup,
 * closes on click-outside, saves immediately on each change.
 */
export function MultiselectCellEditor({
  contactId,
  fieldName,
  options,
  currentValue,
  onClose,
  onSave,
}: {
  contactId: string;
  fieldName: string;
  options: string[];
  currentValue: string[];
  onClose: () => void;
  onSave: (newValue: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(currentValue);
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

  async function toggle(option: string) {
    const newValue = selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option];

    setSelected(newValue);
    onSave(newValue);

    // Save to API
    await fetch(`/api/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customFields: { [fieldName]: newValue } }),
    });
  }

  const selectedSet = new Set(selected);
  const available = options.filter((o) => !selectedSet.has(o));

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-64 max-h-72 overflow-y-auto"
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Selected
      </div>
      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">None selected</p>
      )}
      <div className="flex flex-wrap gap-1 mb-3">
        {selected.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium"
          >
            {val}
            <button
              onClick={() => toggle(val)}
              className="hover:text-red-200 transition-colors"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {available.length > 0 && (
        <>
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Add
          </div>
          <div className="flex flex-wrap gap-1">
            {available.map((val) => (
              <button
                key={val}
                onClick={() => toggle(val)}
                className="inline-flex items-center rounded-full border border-dashed border-primary/30 text-primary/60 px-2 py-0.5 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                + {val}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
