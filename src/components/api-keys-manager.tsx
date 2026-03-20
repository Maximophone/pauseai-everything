"use client";

import { useEffect, useState } from "react";
import { useHasRole } from "@/lib/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, Trash2Icon, CopyIcon, CheckIcon } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export function ApiKeysManager() {
  const isAdmin = useHasRole("admin");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchKeys() {
    const res = await fetch("/api/api-keys");
    if (res.ok) {
      setKeys(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function createKey() {
    if (!newName.trim()) return;
    setCreating(true);

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewKey(data.rawKey);
      setNewName("");
      fetchKeys();
    }
    setCreating(false);
  }

  async function deleteKey(id: string) {
    if (!confirm("Revoke this API key? It will stop working immediately."))
      return;

    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys(keys.filter((k) => k.id !== id));
    }
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Create new key */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Key name (e.g. 'n8n integration')"
          onKeyDown={(e) => {
            if (e.key === "Enter") createKey();
          }}
        />
        <Button onClick={createKey} disabled={!isAdmin || !newName.trim() || creating} title={!isAdmin ? "Admin access required" : undefined}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create
        </Button>
      </div>

      {/* Show newly created key */}
      {newKey && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-800">
            API key created. Copy it now — you won&apos;t be able to see it
            again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono border break-all">
              {newKey}
            </code>
            <Button size="sm" variant="outline" onClick={copyKey}>
              {copied ? (
                <CheckIcon className="h-4 w-4 text-green-600" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setNewKey(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 && !newKey && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No API keys yet. Create one to enable programmatic access.
        </p>
      )}

      {keys.length > 0 && (
        <div className="divide-y rounded-lg border">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">{key.name}</div>
                <div className="text-xs text-muted-foreground">
                  <code>{key.keyPrefix}...</code>
                  {" · "}
                  Created{" "}
                  {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && (
                    <>
                      {" · "}
                      Last used{" "}
                      {new Date(key.lastUsedAt).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteKey(key.id)}
                disabled={!isAdmin}
                title={!isAdmin ? "Admin access required" : undefined}
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
