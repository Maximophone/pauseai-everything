"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  label: string;
  description: string | null;
};

type PrefState = "subscribed" | "unsubscribed" | undefined;

export function SubscriptionCellEditor({
  contactId,
  currentPrefs,
  onClose,
  onSave,
}: {
  contactId: string;
  currentPrefs: Record<string, "subscribed" | "unsubscribed">;
  onClose: () => void;
  onSave: (newPrefs: Record<string, "subscribed" | "unsubscribed">) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [prefs, setPrefs] = useState<Record<string, "subscribed" | "unsubscribed">>({ ...currentPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/communication-categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((cats) => {
        setCategories(cats);
        setLoading(false);
      });
  }, []);

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

  function getState(categoryName: string): PrefState {
    return prefs[categoryName];
  }

  function cycleState(categoryName: string, categoryLabel: string) {
    const current = getState(categoryName);
    const newPrefs = { ...prefs };

    if (current === undefined) {
      // neutral → subscribed
      newPrefs[categoryName] = "subscribed";
    } else if (current === "subscribed") {
      // subscribed → unsubscribed
      newPrefs[categoryName] = "unsubscribed";
    } else {
      // unsubscribed → neutral (with warning)
      const confirmed = confirm(
        `This contact previously unsubscribed from "${categoryLabel}". Are you sure you want to reset their preference?`
      );
      if (!confirmed) return;
      delete newPrefs[categoryName];
    }

    setPrefs(newPrefs);
    // Auto-save
    savePrefs(newPrefs);
  }

  async function savePrefs(newPrefs: Record<string, "subscribed" | "unsubscribed">) {
    setSaving(true);
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communicationPreferences: newPrefs }),
    });
    if (res.ok) {
      onSave(newPrefs);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div ref={ref} className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-64">
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div ref={ref} className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-64">
        <p className="text-xs text-muted-foreground">No categories configured.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-72">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Subscriptions {saving && <span className="text-blue-500">(saving...)</span>}
      </div>
      <div className="space-y-1">
        {categories.map((cat) => {
          const state = getState(cat.name);
          return (
            <button
              key={cat.name}
              onClick={() => cycleState(cat.name, cat.label)}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
            >
              {state === "subscribed" ? (
                <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
              ) : state === "unsubscribed" ? (
                <XCircleIcon className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <MinusCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />
              )}
              <span className="text-xs font-medium flex-1">{cat.label}</span>
              <span
                className={`text-xs shrink-0 ${
                  state === "subscribed"
                    ? "text-green-600"
                    : state === "unsubscribed"
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {state === "subscribed"
                  ? "Subscribed"
                  : state === "unsubscribed"
                  ? "Unsubscribed"
                  : "Neutral"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
        Click to cycle: neutral → subscribed → unsubscribed
      </div>
    </div>
  );
}
