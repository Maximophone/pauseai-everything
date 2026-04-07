"use client";

import { useState, useEffect, useRef } from "react";
import { XIcon } from "lucide-react";

type Tag = { id: string; name: string };

export function TagCellEditor({
  contactId,
  currentTags,
  onClose,
  onSave,
}: {
  contactId: string;
  currentTags: string[];
  onClose: () => void;
  onSave: (newTags: string[]) => void;
}) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/tags").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/contacts/${contactId}/tags`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([tags, cTags]) => {
      setAllTags(tags);
      setContactTags(cTags);
      setLoading(false);
    });
  }, [contactId]);

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

  const contactTagIds = new Set(contactTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !contactTagIds.has(t.id));

  async function addTag(tagId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (res.ok) {
      const updatedTags: Tag[] = await res.json();
      setContactTags(updatedTags);
      onSave(updatedTags.map((t) => t.name));
    }
  }

  async function removeTag(tagId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (res.ok) {
      const updatedTags: Tag[] = await res.json();
      setContactTags(updatedTags);
      onSave(updatedTags.map((t) => t.name));
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
      const newTag: Tag = await createRes.json();
      setAllTags((prev) => [...prev, newTag]);
      setNewTagName("");
      await addTag(newTag.id);
    } else if (createRes.status === 409) {
      // Tag already exists — find it and add
      const existing = allTags.find(
        (t) => t.name.toLowerCase() === newTagName.trim().toLowerCase()
      );
      if (existing) {
        setNewTagName("");
        await addTag(existing.id);
      }
    }
  }

  if (loading) {
    return (
      <div
        ref={ref}
        className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-64"
      >
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-white rounded-lg border shadow-lg p-3 w-64 max-h-72 overflow-y-auto"
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Current tags
      </div>
      {contactTags.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">No tags</p>
      )}
      <div className="flex flex-wrap gap-1 mb-3">
        {contactTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="hover:text-red-500 transition-colors"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {availableTags.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Add tag
          </div>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addTag(e.target.value);
            }}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Select a tag…</option>
            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-1">
        <input
          type="text"
          placeholder="New tag..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createAndAddTag();
          }}
          className="flex-1 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={createAndAddTag}
          disabled={!newTagName.trim()}
          className="rounded bg-primary text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
