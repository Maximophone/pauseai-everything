"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHasRole } from "@/lib/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon } from "lucide-react";

export function AddContactButton() {
  const router = useRouter();
  const canEdit = useHasRole("member");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingContact, setExistingContact] = useState<{
    contactId: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null>(null);

  function resetState() {
    setError(null);
    setExistingContact(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    resetState();

    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: (formData.get("firstName") as string) || null,
      lastName: (formData.get("lastName") as string) || null,
      email: (formData.get("email") as string) || null,
    };

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.existsInNetwork) {
          setExistingContact({
            contactId: data.contactId,
            ...payload,
          });
          return;
        }
        setError(data.error || "Failed to create contact.");
        return;
      }

      setOpen(false);
      window.dispatchEvent(new Event("contacts-changed"));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToWorkspace() {
    if (!existingContact) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: existingContact.firstName,
          lastName: existingContact.lastName,
          email: existingContact.email,
          addToWorkspace: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add contact to workspace.");
        return;
      }

      setOpen(false);
      setExistingContact(null);
      window.dispatchEvent(new Event("contacts-changed"));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (canEdit) { setOpen(v); if (!v) resetState(); } }}>
      <span title={!canEdit ? "Member access required" : undefined}>
        <DialogTrigger render={<Button disabled={!canEdit} />}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Contact
        </DialogTrigger>
      </span>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Quick add a new contact. You can fill in more details later.
          </DialogDescription>
        </DialogHeader>
        {existingContact ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-medium text-amber-900">
                This person already exists in the PauseAI network.
              </p>
              <p className="mt-1 text-amber-700">
                A contact with the email <strong>{existingContact.email}</strong> is
                already in the system. You can add them to your current workspace.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); resetState(); }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddToWorkspace} disabled={loading}>
                {loading ? "Adding..." : "Add to Workspace"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@example.com"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Contact"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
