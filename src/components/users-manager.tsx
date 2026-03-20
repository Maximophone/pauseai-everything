"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldIcon,
  ShieldOffIcon,
  TrashIcon,
  PlusIcon,
  MailIcon,
  Loader2Icon,
} from "lucide-react";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
};

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function fetchUsers() {
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });

    if (res.ok) {
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      fetchUsers();
    } else {
      const data = await res.json();
      setInviteError(data.error || "Failed to invite user");
    }

    setInviting(false);
  }

  async function toggleAdmin(userId: string, currentIsAdmin: boolean) {
    const action = currentIsAdmin ? "remove admin from" : "make admin";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !currentIsAdmin }),
    });

    if (res.ok) {
      fetchUsers();
    }
  }

  async function handleDelete(userId: string, email: string | null) {
    if (
      !confirm(
        `Are you sure you want to remove ${email || "this user"}? They will no longer be able to sign in.`
      )
    )
      return;

    const res = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to remove user");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="text-sm font-medium text-foreground"
          >
            Invite a new user
          </label>
          <Input
            id="invite-email"
            type="email"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
          {inviting ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <MailIcon className="h-4 w-4" />
          )}
          <span className="ml-2">Send Invite</span>
        </Button>
      </form>

      {inviteError && (
        <p className="text-sm text-red-600">{inviteError}</p>
      )}
      {inviteSuccess && (
        <p className="text-sm text-green-600">{inviteSuccess}</p>
      )}

      {/* Users list */}
      <div className="divide-y rounded-lg border">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(user.name || user.email || "?")[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-medium">
                  {user.name || (
                    <span className="text-muted-foreground italic">
                      Invited — not yet signed in
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.isAdmin && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  Admin
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleAdmin(user.id, user.isAdmin)}
                title={user.isAdmin ? "Remove admin" : "Make admin"}
              >
                {user.isAdmin ? (
                  <ShieldOffIcon className="h-4 w-4" />
                ) : (
                  <ShieldIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(user.id, user.email)}
                title="Remove user"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No users yet. Invite someone using the form above.
        </p>
      )}
    </div>
  );
}
