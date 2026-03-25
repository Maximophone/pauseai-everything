"use client";

import { useState, useEffect } from "react";
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon } from "lucide-react";
import { useWorkspaceId, useWorkspaceFetch } from "./workspace-provider";

type Category = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  workspaceId: string | null;
};

/**
 * Build the namespaced preference key for a category.
 * Format: "workspaceId:categoryName"
 */
function prefKey(cat: Category, fallbackWorkspaceId: string | null | undefined): string {
  const wsId = cat.workspaceId ?? fallbackWorkspaceId;
  return wsId ? `${wsId}:${cat.name}` : cat.name;
}

export function ContactPreferences({
  contactId,
  initialPreferences,
}: {
  contactId: string;
  initialPreferences: Record<string, "subscribed" | "unsubscribed">;
}) {
  const workspaceId = useWorkspaceId();
  const wsFetch = useWorkspaceFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [prefs, setPrefs] = useState<Record<string, "subscribed" | "unsubscribed">>(initialPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wsFetch("/api/communication-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((cats) => {
        setCategories(cats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [wsFetch]);

  async function togglePref(cat: Category) {
    const key = prefKey(cat, workspaceId);
    const current = prefs[key]; // "subscribed" | "unsubscribed" | undefined (neutral)
    const newPrefs = { ...prefs };

    if (current === undefined) {
      // neutral -> subscribed
      newPrefs[key] = "subscribed";
    } else if (current === "subscribed") {
      // subscribed -> unsubscribed
      newPrefs[key] = "unsubscribed";
    } else {
      // unsubscribed -> neutral (with confirmation)
      const confirmed = confirm(
        `This contact previously unsubscribed from ${cat.label}. Are you sure you want to change their preference?`
      );
      if (!confirmed) return;
      delete newPrefs[key];
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

  const hasAnyOptOut = categories.some(
    (c) => prefs[prefKey(c, workspaceId)] === "unsubscribed"
  );

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
          const key = prefKey(cat, workspaceId);
          const status = prefs[key]; // "subscribed" | "unsubscribed" | undefined
          return (
            <button
              key={cat.id}
              onClick={() => togglePref(cat)}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
            >
              {status === "unsubscribed" ? (
                <XCircleIcon className="h-4 w-4 text-red-500 shrink-0" />
              ) : status === "subscribed" ? (
                <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <MinusCircleIcon className="h-4 w-4 text-gray-400 shrink-0" />
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
                  status === "unsubscribed"
                    ? "text-red-500"
                    : status === "subscribed"
                      ? "text-green-600"
                      : "text-gray-400"
                }`}
              >
                {status === "unsubscribed"
                  ? "Unsubscribed"
                  : status === "subscribed"
                    ? "Subscribed"
                    : "Not subscribed"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
