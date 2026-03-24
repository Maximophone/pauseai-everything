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

type WorkspaceSection = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceType: "global" | "chapter";
  subscriptionStatus: "subscribed" | "unsubscribed" | "neutral";
  categories: CategoryInfo[];
};

function UnsubscribeContent() {
  const params = useSearchParams();
  const contactId = params.get("contact");
  const workspaceId = params.get("workspace");
  const category = params.get("category");
  const token = params.get("token");

  const [workspaceSections, setWorkspaceSections] = useState<
    WorkspaceSection[] | null
  >(null);
  const [globallyUnsubscribed, setGloballyUnsubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = contactId && workspaceId && category && token;

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }

    // Auto-unsubscribe from the specified category on load (one-click)
    fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, workspaceId, category, token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to unsubscribe.");
          setLoading(false);
          return;
        }
        // Load preference center
        return fetch(
          `/api/unsubscribe/preferences?contact=${contactId}&workspace=${workspaceId}&category=${category}&token=${token}`
        );
      })
      .then(async (res) => {
        if (!res) return;
        if (res.ok) {
          const data = await res.json();
          setWorkspaceSections(data.workspaces);
          setGloballyUnsubscribed(data.globallyUnsubscribed);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Something went wrong.");
        setLoading(false);
      });
  }, [valid, contactId, workspaceId, category, token]);

  async function savePreferences() {
    if (!workspaceSections || !contactId || !workspaceId || !category || !token)
      return;
    setSaving(true);

    const preferences: Record<string, "subscribed" | "unsubscribed"> = {};
    for (const ws of workspaceSections) {
      for (const cat of ws.categories) {
        const key = `${ws.workspaceId}:${cat.name}`;
        preferences[key] =
          cat.status === "unsubscribed" ? "unsubscribed" : "subscribed";
      }
    }

    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, workspaceId, category, token, preferences }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save preferences.");
    }
    setSaving(false);
  }

  async function handleWorkspaceUnsubscribe(wsId: string) {
    if (!contactId || !workspaceId || !category || !token) return;
    setSaving(true);

    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        workspaceId,
        category,
        token,
        unsubscribeFromWorkspace: wsId,
      }),
    });

    if (res.ok) {
      // Update local state
      setWorkspaceSections(
        (prev) =>
          prev?.map((ws) =>
            ws.workspaceId === wsId
              ? { ...ws, subscriptionStatus: "unsubscribed" as const }
              : ws
          ) ?? null
      );
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to unsubscribe.");
    }
    setSaving(false);
  }

  async function handleGlobalUnsubscribe() {
    if (!contactId || !workspaceId || !category || !token) return;
    setSaving(true);

    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        workspaceId,
        category,
        token,
        globalUnsubscribe: true,
      }),
    });

    if (res.ok) {
      setGloballyUnsubscribed(true);
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to unsubscribe.");
    }
    setSaving(false);
  }

  if (!valid) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
        <p className="text-gray-600">
          This unsubscribe link is invalid or incomplete.
        </p>
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

  if (done || globallyUnsubscribed) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">
          {globallyUnsubscribed ? "Fully Unsubscribed" : "Preferences Updated"}
        </h1>
        <p className="text-gray-600">
          {globallyUnsubscribed
            ? "You will no longer receive any communications from PauseAI."
            : "Your communication preferences have been saved."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">You&apos;ve been unsubscribed</h1>
      <p className="text-gray-600 mb-6">
        You will no longer receive <strong>{category}</strong> emails.
      </p>

      {workspaceSections && workspaceSections.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Manage your preferences</h2>
          <p className="text-sm text-gray-500">
            Choose which types of emails you&apos;d like to receive from each
            PauseAI workspace:
          </p>

          {workspaceSections.map((ws) => (
            <div
              key={ws.workspaceId}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{ws.workspaceName}</h3>
                {ws.subscriptionStatus === "unsubscribed" && (
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    Unsubscribed
                  </span>
                )}
              </div>

              {ws.subscriptionStatus === "unsubscribed" ? (
                <p className="text-sm text-gray-500">
                  You are unsubscribed from all communications from{" "}
                  {ws.workspaceName}.
                </p>
              ) : (
                <>
                  {ws.categories.length > 0 ? (
                    <div className="space-y-2">
                      {ws.categories.map((cat) => (
                        <label
                          key={cat.id}
                          className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={cat.status !== "unsubscribed"}
                            onChange={() => {
                              setWorkspaceSections(
                                (prev) =>
                                  prev?.map((section) =>
                                    section.workspaceId === ws.workspaceId
                                      ? {
                                          ...section,
                                          categories: section.categories.map(
                                            (c) =>
                                              c.name === cat.name
                                                ? {
                                                    ...c,
                                                    status:
                                                      c.status ===
                                                      "unsubscribed"
                                                        ? ("subscribed" as const)
                                                        : ("unsubscribed" as const),
                                                  }
                                                : c
                                          ),
                                        }
                                      : section
                                  ) ?? null
                              );
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
                          />
                          <div>
                            <div className="font-medium text-sm">
                              {cat.label}
                            </div>
                            {cat.description && (
                              <div className="text-xs text-gray-500">
                                {cat.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No email categories configured for this workspace.
                    </p>
                  )}

                  <button
                    onClick={() => handleWorkspaceUnsubscribe(ws.workspaceId)}
                    disabled={saving}
                    className="text-sm text-red-600 hover:text-red-700 underline disabled:opacity-50"
                  >
                    Unsubscribe from all {ws.workspaceName} emails
                  </button>
                </>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>

            <button
              onClick={handleGlobalUnsubscribe}
              disabled={saving}
              className="text-sm text-red-600 hover:text-red-700 underline disabled:opacity-50"
            >
              Unsubscribe from all PauseAI communications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border p-8">
        <Suspense
          fallback={
            <div className="text-center">
              <p>Loading...</p>
            </div>
          }
        >
          <UnsubscribeContent />
        </Suspense>
        <div className="mt-8 text-center text-xs text-gray-400">PauseAI</div>
      </div>
    </div>
  );
}
