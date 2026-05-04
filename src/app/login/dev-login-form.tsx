"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

const PRESET_USERS = [
  { email: "admin@pauseai.info", name: "Admin User", role: "admin", description: "Global admin — full access to all workspaces" },
  { email: "member@pauseai.info", name: "Member User", role: "member", description: "Global member — member of Global workspace" },
  { email: "viewer@pauseai.info", name: "Viewer User", role: "viewer", description: "Global viewer — read-only access" },
  { email: "france@pauseai.info", name: "France Chapter Admin", role: "member", description: "Global member — admin of France workspace only" },
];

function setWorkspaceCookie(workspaceId: string) {
  document.cookie = `pauseai_workspace=${workspaceId}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=strict`;
}

export function DevLoginForm({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  // Render client-only — password manager extensions inject extra DOM nodes
  // into the input fields below, which causes a hydration mismatch on SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  async function handleLogin(
    loginEmail: string,
    loginName: string,
    loginRole: string
  ) {
    setLoading(true);
    if (workspaceId) {
      setWorkspaceCookie(workspaceId);
    }
    await signIn("dev-login", {
      email: loginEmail,
      name: loginName,
      role: loginRole,
      workspaceId: workspaceId || undefined,
      redirectTo: "/dashboard",
    });
  }

  return (
    <div className="space-y-3">
      {/* Workspace selector */}
      {workspaces.length > 1 && (
        <div>
          <label className="text-xs font-medium text-amber-800">
            Login to workspace
          </label>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} {ws.type === "global" ? "(Global)" : `(${ws.slug})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quick preset buttons */}
      <div className="grid grid-cols-2 gap-2">
        {PRESET_USERS.map((user) => (
          <button
            key={user.email}
            onClick={() => handleLogin(user.email, user.name, user.role)}
            disabled={loading}
            className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <div className="font-medium text-amber-900">{user.name}</div>
            <div className="text-amber-600">{user.description}</div>
          </button>
        ))}
      </div>

      {/* Custom email form */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Custom email...
        </summary>
        <div className="mt-2 space-y-2">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "admin" | "member" | "viewer")
            }
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={() =>
              handleLogin(email, name || email.split("@")[0], role)
            }
            disabled={loading || !email}
            className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in as this user"}
          </button>
        </div>
      </details>
    </div>
  );
}
