"use client";

import { useState, useEffect } from "react";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";

type Category = {
  id: string;
  name: string;
  label: string;
  description: string | null;
};

export function ContactPreferences({
  contactId,
  initialPreferences,
}: {
  contactId: string;
  initialPreferences: Record<string, boolean>;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/communication-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((cats) => {
        setCategories(cats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function togglePref(categoryName: string) {
    const currentlyOptedOut = prefs[categoryName] === false;
    const newPrefs = { ...prefs };

    if (currentlyOptedOut) {
      // Re-subscribe: remove the key (default = opted in)
      delete newPrefs[categoryName];
    } else {
      // Unsubscribe
      newPrefs[categoryName] = false;
    }

    setPrefs(newPrefs);

    // Save to API
    await fetch(`/api/contacts/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communicationPreferences: newPrefs }),
    });
  }

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground">
        Loading preferences...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No communication categories configured.
      </div>
    );
  }

  const hasAnyOptOut = categories.some((c) => prefs[c.name] === false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">Communication Preferences</h4>
        {hasAnyOptOut && (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50">
            Partial opt-out
          </span>
        )}
      </div>
      <div className="space-y-1">
        {categories.map((cat) => {
          const optedOut = prefs[cat.name] === false;
          return (
            <button
              key={cat.name}
              onClick={() => togglePref(cat.name)}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
            >
              {optedOut ? (
                <XCircleIcon className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-medium">{cat.label}</span>
                {cat.description && (
                  <span className="text-xs text-muted-foreground ml-1">
                    — {cat.description}
                  </span>
                )}
              </div>
              <span
                className={`ml-auto text-xs shrink-0 ${
                  optedOut ? "text-red-500" : "text-green-600"
                }`}
              >
                {optedOut ? "Unsubscribed" : "Subscribed"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
