"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  SaveIcon,
  XIcon,
  GlobeIcon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  type: "global" | "chapter";
  defaultLanguage: string;
  createdAt: string;
};

export function WorkspacesManager({
  initialWorkspaces,
  isGlobalAdmin,
}: {
  initialWorkspaces: Workspace[];
  isGlobalAdmin: boolean;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editLang, setEditLang] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newLang, setNewLang] = useState("en");
  const [error, setError] = useState("");

  if (!isGlobalAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only global administrators can manage workspaces.
      </p>
    );
  }

  async function fetchWorkspaces() {
    const res = await fetch("/api/workspaces");
    if (res.ok) setWorkspaces(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        slug: newSlug.trim().toLowerCase(),
        type: "chapter",
        defaultLanguage: newLang.trim() || "en",
      }),
    });

    if (res.ok) {
      setNewName("");
      setNewSlug("");
      setNewLang("en");
      setShowCreate(false);
      fetchWorkspaces();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create workspace");
    }
  }

  async function handleUpdate(id: string) {
    setError("");
    const res = await fetch(`/api/workspaces/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase(),
        defaultLanguage: editLang.trim(),
      }),
    });

    if (res.ok) {
      setEditingId(null);
      fetchWorkspaces();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update workspace");
    }
  }

  async function handleDelete(ws: Workspace) {
    if (ws.type === "global") return;
    if (
      !confirm(
        `Are you sure you want to delete "${ws.name}"? This will remove all workspace memberships. Contacts and data will remain in the system.`
      )
    )
      return;

    const res = await fetch(`/api/workspaces/${ws.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchWorkspaces();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete workspace");
    }
  }

  function startEdit(ws: Workspace) {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditSlug(ws.slug);
    setEditLang(ws.defaultLanguage);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Create button */}
      {!showCreate && (
        <Button onClick={() => setShowCreate(true)} size="sm">
          <PlusIcon className="h-4 w-4 mr-1" />
          New Workspace
        </Button>
      )}

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border p-4 space-y-3"
        >
          <h3 className="text-sm font-medium">Create a new workspace</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Pause IA France"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Slug (URL-friendly)
              </label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="france"
                className="mt-1"
              />
            </div>
          </div>
          <div className="w-1/2">
            <label className="text-xs text-muted-foreground">
              Default Language
            </label>
            <Input
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              placeholder="en"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!newName || !newSlug}>
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Workspaces list */}
      <div className="divide-y rounded-lg border">
        {workspaces.map((ws) => (
          <div key={ws.id} className="px-4 py-3">
            {editingId === ws.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                  />
                  <Input
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    placeholder="Slug"
                    disabled={ws.type === "global"}
                  />
                  <Input
                    value={editLang}
                    onChange={(e) => setEditLang(e.target.value)}
                    placeholder="Language"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdate(ws.id)}
                  >
                    <SaveIcon className="h-3 w-3 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <XIcon className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {ws.type === "global" ? (
                      <GlobeIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {ws.name}
                      <span className="text-xs text-muted-foreground font-normal">
                        /{ws.slug}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          ws.type === "global"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {ws.type}
                      </span>
                      <span>lang: {ws.defaultLanguage}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(ws)}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  {ws.type !== "global" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(ws)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {workspaces.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No workspaces found.
        </p>
      )}
    </div>
  );
}
