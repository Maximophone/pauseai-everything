"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldIcon, ShieldOffIcon } from "lucide-react";

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="max-w-2xl">
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
                  {user.name || "Unnamed"}
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
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No users yet. Users are created when they sign in with Google.
        </p>
      )}
    </div>
  );
}
