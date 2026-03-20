"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

type CategoryInfo = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  status: "subscribed" | "unsubscribed" | "neutral";
};

function UnsubscribeContent() {
  const params = useSearchParams();
  const contactId = params.get("contact");
  const category = params.get("category");
  const token = params.get("token");

  const [categories, setCategories] = useState<CategoryInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = contactId && category && token;

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }

    // Auto-unsubscribe from the specified category on load (one-click)
    fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, category, token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to unsubscribe.");
          setLoading(false);
          return;
        }
        // Load all categories so user can manage preferences
        return fetch(`/api/unsubscribe/preferences?contact=${contactId}&category=${category}&token=${token}`);
      })
      .then(async (res) => {
        if (!res) return;
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Something went wrong.");
        setLoading(false);
      });
  }, [valid, contactId, category, token]);

  async function savePreferences() {
    if (!categories || !contactId || !category || !token) return;
    setSaving(true);

    const preferences: Record<string, "subscribed" | "unsubscribed"> = {};
    for (const cat of categories) {
      preferences[cat.name] = cat.status === "unsubscribed" ? "unsubscribed" : "subscribed";
    }

    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, category, token, preferences }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save preferences.");
    }
    setSaving(false);
  }

  if (!valid) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
        <p className="text-gray-600">This unsubscribe link is invalid or incomplete.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Processing...</h1>
        <p className="text-gray-600">Updating your preferences...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2 text-red-600">Error</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Preferences Updated</h1>
        <p className="text-gray-600">Your communication preferences have been saved.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">You&apos;ve been unsubscribed</h1>
      <p className="text-gray-600 mb-6">
        You will no longer receive <strong>{category}</strong> emails from PauseAI.
      </p>

      {categories && categories.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Manage your preferences</h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose which types of emails you&apos;d like to receive:
          </p>

          <div className="space-y-3">
            {categories.map((cat) => (
              <label
                key={cat.name}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={cat.status !== "unsubscribed"}
                  onChange={() => {
                    setCategories(
                      categories.map((c) =>
                        c.name === cat.name
                          ? { ...c, status: c.status === "unsubscribed" ? "subscribed" as const : "unsubscribed" as const }
                          : c
                      )
                    );
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <div className="font-medium text-sm">{cat.label}</div>
                  {cat.description && (
                    <div className="text-xs text-gray-500">{cat.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={savePreferences}
            disabled={saving}
            className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border p-8">
        <Suspense fallback={<div className="text-center"><p>Loading...</p></div>}>
          <UnsubscribeContent />
        </Suspense>
        <div className="mt-8 text-center text-xs text-gray-400">
          PauseAI
        </div>
      </div>
    </div>
  );
}
