"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, XIcon } from "lucide-react";

type Tag = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
};

export function ContactTags({ contactId }: { contactId: string }) {
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    const [contactRes, allRes] = await Promise.all([
      fetch(`/api/contacts/${contactId}/tags`),
      fetch("/api/tags"),
    ]);
    if (contactRes.ok) setContactTags(await contactRes.json());
    if (allRes.ok) setAllTags(await allRes.json());
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  async function addTag(tagId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (res.ok) {
      setContactTags(await res.json());
    }
  }

  async function removeTag(tagId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (res.ok) {
      setContactTags(await res.json());
    }
  }

  async function createAndAddTag() {
    if (!newTagName.trim()) return;

    const createRes = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim() }),
    });

    if (createRes.ok) {
      const newTag = await createRes.json();
      await addTag(newTag.id);
      setNewTagName("");
      // Refresh all tags list
      const allRes = await fetch("/api/tags");
      if (allRes.ok) setAllTags(await allRes.json());
    }
  }

  const availableTags = allTags.filter(
    (t) => !contactTags.some((ct) => ct.id === t.id)
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading tags...</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Tags</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowPicker(!showPicker)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {contactTags.length === 0 && (
          <span className="text-sm text-muted-foreground">No tags</span>
        )}
        {contactTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="hover:text-destructive transition-colors"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Tag picker */}
      {showPicker && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          {availableTags.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addTag(e.target.value);
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="">+ Add tag…</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createAndAddTag();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={createAndAddTag}
              disabled={!newTagName.trim()}
              className="h-8"
            >
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
