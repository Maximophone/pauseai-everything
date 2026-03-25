"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrashIcon,
  MailIcon,
  Loader2Icon,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";

type UserRole = "admin" | "member" | "viewer";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
  globalRole?: UserRole;
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const roleColors: Record<UserRole, string> = {
  admin: "bg-red-100 text-red-700",
  member: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
};

export function UsersManager() {
  const { activeWorkspace } = useWorkspace();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, [activeWorkspace?.id]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });

    if (res.ok) {
      const data = await res.json();
      const msg = data.alreadyExisted
        ? `${inviteEmail.trim()} added to this workspace`
        : `Invitation sent to ${inviteEmail.trim()}`;
      setInviteSuccess(msg);
      setInviteEmail("");
      setInviteRole("viewer");
      fetchUsers();
    } else {
      const data = await res.json();
      setInviteError(data.error || "Failed to invite user");
    }

    setInviting(false);
  }

  async function changeRole(userId: string, newRole: UserRole) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update role");
    }
  }

  async function handleRemove(userId: string, email: string | null) {
    if (
      !confirm(
        `Are you sure you want to remove ${email || "this user"} from ${activeWorkspace?.name || "this workspace"}? They will lose access to this workspace but remain in the system.`
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
      {/* Workspace context */}
      {activeWorkspace && (
        <p className="text-sm text-muted-foreground">
          Managing members of <strong>{activeWorkspace.name}</strong>
        </p>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="invite-email"
            className="text-sm font-medium text-foreground"
          >
            Add a user to this workspace
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
        <div>
          <label
            htmlFor="invite-role"
            className="text-sm font-medium text-foreground"
          >
            Role
          </label>
          <select
            id="invite-role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as UserRole)}
            className="mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="viewer">Viewer</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
          {inviting ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <MailIcon className="h-4 w-4" />
          )}
          <span className="ml-2">Add User</span>
        </Button>
      </form>

      {inviteError && (
        <p className="text-sm text-red-600">{inviteError}</p>
      )}
      {inviteSuccess && (
        <p className="text-sm text-green-600">{inviteSuccess}</p>
      )}

      {/* Role descriptions */}
      <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1">
        <p><strong>Admin</strong> — Full access to this workspace. Manage users, settings, campaigns, and all data.</p>
        <p><strong>Member</strong> — Can view and edit contacts, tags, and interactions within this workspace.</p>
        <p><strong>Viewer</strong> — Read-only access to this workspace.</p>
      </div>

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
              <select
                value={user.role}
                onChange={(e) => changeRole(user.id, e.target.value as UserRole)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer ${roleColors[user.role]}`}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(user.id, user.email)}
                title="Remove from workspace"
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
          No members in this workspace yet. Add someone using the form above.
        </p>
      )}
    </div>
  );
}
