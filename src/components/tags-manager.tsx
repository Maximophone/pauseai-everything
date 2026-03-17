"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon } from "lucide-react";

type Tag = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
};

export function TagsManager({ initialTags }: { initialTags: Tag[] }) {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createTag() {
    if (!newName.trim()) return;
    setCreating(true);

    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (res.ok) {
      setNewName("");
      router.refresh();
      // Refetch
      const allRes = await fetch("/api/tags");
      if (allRes.ok) setTags(await allRes.json());
    }
    setCreating(false);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;

    const res = await fetch(`/api/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });

    if (res.ok) {
      setEditingId(null);
      const allRes = await fetch("/api/tags");
      if (allRes.ok) setTags(await allRes.json());
    }
  }

  async function deleteTag(id: string) {
    if (!confirm("Delete this tag? It will be removed from all contacts.")) return;

    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTags(tags.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      {/* Create new tag */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag name..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createTag();
            }
          }}
        />
        <Button onClick={createTag} disabled={!newName.trim() || creating}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create
        </Button>
      </div>

      {/* Tag list */}
      {tags.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No tags yet. Create one above.
        </p>
      )}

      <div className="divide-y rounded-lg border">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between px-4 py-3"
          >
            {editingId === tag.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(tag.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => saveEdit(tag.id)}
                >
                  <CheckIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-sm font-medium">
                  {tag.name}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditName(tag.name);
                    }}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteTag(tag.id)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
