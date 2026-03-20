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
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  function resetCreate() {
    setNewName("");
    setNewLabel("");
    setNewDescription("");
    setNewSortOrder(categories.length);
    setShowCreate(false);
    setError(null);
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditLabel(cat.label);
    setEditDescription(cat.description || "");
    setEditSortOrder(cat.sortOrder);
    setError(null);
  }

  async function handleCreate() {
    if (!newName.trim() || !newLabel.trim()) return;
    setCreating(true);
    setError(null);

    const res = await fetch("/api/communication-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        label: newLabel.trim(),
        description: newDescription.trim() || null,
        sortOrder: newSortOrder,
      }),
    });

    if (res.ok) {
      const cat = await res.json();
      setCategories([...categories, cat].sort((a, b) => a.sortOrder - b.sortOrder));
      resetCreate();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || data.details?.join(", ") || "Failed to create category.");
    }
    setCreating(false);
  }

  async function handleSave(id: string) {
    if (!editLabel.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/communication-categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        label: editLabel.trim(),
        description: editDescription.trim() || null,
        sortOrder: editSortOrder,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setCategories(
        categories.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setEditingId(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || data.details?.join(", ") || "Failed to update category.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this email category? Campaigns using it will become transactional.")) return;

    const res = await fetch(`/api/communication-categories/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setCategories(categories.filter((c) => c.id !== id));
      if (editingId === id) setEditingId(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete category.");
    }
  }

  // Auto-generate slug from label
  function handleLabelChange(label: string, setNameFn: (n: string) => void) {
    setNameFn(
      label
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {!showCreate && (
        <Button onClick={() => { setNewSortOrder(categories.length); setShowCreate(true); }}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      )}

      {showCreate && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Category</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Label</label>
              <Input
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  handleLabelChange(e.target.value, setNewName);
                }}
                placeholder="e.g. Newsletter"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Slug</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. newsletter"
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief description shown to contacts on unsubscribe page"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newLabel.trim()}
              size="sm"
            >
              {creating ? "Creating..." : "Create Category"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetCreate}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {categories.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No email categories configured yet.
        </p>
      )}

      {categories.length > 0 && (
        <div className="divide-y rounded-lg border">
          {categories.map((cat) => (
            <div key={cat.id} className="px-4 py-3">
              {editingId === cat.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Label</label>
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Slug</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(cat.id)} disabled={saving || !editLabel.trim()}>
                      <SaveIcon className="mr-1 h-3 w-3" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <XIcon className="mr-1 h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{cat.name}</span>
                      {cat.description && (
                        <span className="ml-2">— {cat.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(cat)} title="Edit">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)} title="Delete">
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
