"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MailIcon,
  PhoneIcon,
  VideoIcon,
  StickyNoteIcon,
  FileTextIcon,
  CalendarIcon,
  HandIcon,
  ArrowRightIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

type Interaction = {
  id: string;
  contactId: string;
  userId: string | null;
  type: string;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

const INTERACTION_TYPES = [
  { value: "email_sent", label: "Email Sent", icon: MailIcon },
  { value: "email_received", label: "Email Received", icon: MailIcon },
  { value: "call", label: "Phone Call", icon: PhoneIcon },
  { value: "meeting", label: "Meeting", icon: VideoIcon },
  { value: "note", label: "Note", icon: StickyNoteIcon },
  { value: "form_submission", label: "Form Submission", icon: FileTextIcon },
  { value: "event_attended", label: "Event Attended", icon: CalendarIcon },
  { value: "action_taken", label: "Action Taken", icon: HandIcon },
  { value: "stage_change", label: "Stage Change", icon: ArrowRightIcon },
];

function getTypeInfo(type: string) {
  return INTERACTION_TYPES.find((t) => t.value === type) ?? {
    value: type,
    label: type,
    icon: StickyNoteIcon,
  };
}

export function InteractionTimeline({ contactId }: { contactId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchInteractions = useCallback(async () => {
    const res = await fetch(`/api/contacts/${contactId}/interactions`);
    if (res.ok) {
      const data = await res.json();
      setInteractions(data.interactions);
    }
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  async function onDelete(id: string) {
    if (!confirm("Delete this interaction?")) return;
    await fetch(`/api/interactions/${id}`, { method: "DELETE" });
    fetchInteractions();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Interactions</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Log Interaction
        </Button>
      </div>

      {showForm && (
        <LogInteractionForm
          contactId={contactId}
          onSaved={() => {
            setShowForm(false);
            fetchInteractions();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {!loading && interactions.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No interactions logged yet.
        </p>
      )}

      <div className="space-y-1">
        {interactions.map((interaction) => {
          const typeInfo = getTypeInfo(interaction.type);
          const Icon = typeInfo.icon;
          return (
            <div
              key={interaction.id}
              className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 group"
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {typeInfo.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(interaction.occurredAt).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                </div>
                {interaction.subject && (
                  <p className="text-sm font-medium mt-0.5">
                    {interaction.subject}
                  </p>
                )}
                {interaction.body && (
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                    {interaction.body}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(interaction.id)}
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogInteractionForm({
  contactId,
  onSaved,
  onCancel,
}: {
  contactId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch(`/api/contacts/${contactId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        subject: subject || null,
        body: body || null,
        occurredAt: new Date(occurredAt).toISOString(),
      }),
    });

    if (res.ok) {
      onSaved();
    }
    setSaving(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border rounded-lg p-4 space-y-3 bg-muted/30"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="interactionType">Type</Label>
          <select
            id="interactionType"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {INTERACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="occurredAt">Date</Label>
          <Input
            id="occurredAt"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief description..."
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="body">Notes</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Details..."
          rows={3}
          className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
