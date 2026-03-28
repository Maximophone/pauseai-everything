"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspaceFetch } from "@/components/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  MailIcon,
  RefreshCwIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
  UnplugIcon,
  SettingsIcon,
  UserPlusIcon,
} from "lucide-react";

type EmailConnection = {
  id: string;
  provider: string;
  providerAccountEmail: string;
  defaultSyncInteractions: boolean;
  defaultInteractionsVisible: boolean;
  syncIntervalMinutes: string;
  lastSyncedAt: string | null;
  status: string;
  statusMessage: string | null;
  createdAt: string;
};

type GmailContact = {
  email: string;
  gmailName: string;
  inCrm: boolean;
  inCurrentWorkspace: boolean;
  crmContactId: string | null;
  crmFirstName: string | null;
  crmLastName: string | null;
  syncInteractions: boolean | null;
  interactionsVisible: boolean | null;
};

export function MyEmailContacts() {
  const wsFetch = useWorkspaceFetch();
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await wsFetch("/api/email-connections");
      if (res.ok) {
        setConnections(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [wsFetch]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Check for callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      fetchConnections();
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")) {
      setError(params.get("error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchConnections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeConnection = connections.find((c) => c.status === "connected");

  if (!activeConnection) {
    return <ConnectPrompt error={error} />;
  }

  return (
    <ConnectedView
      connection={activeConnection}
      onDisconnect={fetchConnections}
    />
  );
}

// ---------- Not Connected State ----------

function ConnectPrompt({ error }: { error: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-muted p-4 mb-6">
        <MailIcon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        Connect your email account
      </h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        See everyone you&apos;ve emailed, add them to your workspace with one click,
        and automatically log email interactions on their timelines.
      </p>
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md px-4 py-2 mb-4 text-sm">
          {error}
        </div>
      )}
      <a href="/api/auth/gmail">
        <Button size="lg">
          <MailIcon className="mr-2 h-4 w-4" />
          Connect Gmail Account
        </Button>
      </a>
      <p className="text-xs text-muted-foreground mt-4">
        We request read-only access to your email. You can disconnect at any time.
      </p>
    </div>
  );
}

// ---------- Connected State ----------

function ConnectedView({
  connection,
  onDisconnect,
}: {
  connection: EmailConnection;
  onDisconnect: () => void;
}) {
  const wsFetch = useWorkspaceFetch();
  const [gmailContacts, setGmailContacts] = useState<GmailContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await wsFetch(
        `/api/email-connections/${connection.id}/contacts`
      );
      if (res.ok) {
        const data = await res.json();
        setGmailContacts(data.contacts);
      }
    } catch {
      // ignore
    } finally {
      setLoadingContacts(false);
    }
  }, [wsFetch, connection.id]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Gmail account? This will stop interaction syncing.")) return;
    setDisconnecting(true);
    try {
      await wsFetch(`/api/email-connections/${connection.id}`, {
        method: "DELETE",
      });
      onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefreshSync = async () => {
    setRefreshing(true);
    try {
      await wsFetch(`/api/email-connections/${connection.id}/refresh`, {
        method: "POST",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleImportSelected = async () => {
    const toImport = gmailContacts.filter(
      (c) => selected.has(c.email) && !c.inCurrentWorkspace
    );
    if (toImport.length === 0) return;

    setImporting(true);
    setImportResult(null);
    try {
      const res = await wsFetch(
        `/api/email-connections/${connection.id}/contacts/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: toImport.map((c) => ({
              email: c.email,
              name: c.gmailName,
              syncInteractions: connection.defaultSyncInteractions,
              interactionsVisible: connection.defaultInteractionsVisible,
            })),
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setImportResult(
          `Added ${data.created} new contacts, ${data.addedToWorkspace} to workspace. ${data.alreadyInWorkspace} already in workspace.`
        );
        setSelected(new Set());
        fetchContacts();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleToggleSetting = async (
    contactId: string,
    field: "syncInteractions" | "interactionsVisible",
    value: boolean
  ) => {
    await wsFetch(`/api/email-contact-settings/${contactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    // Update local state
    setGmailContacts((prev) =>
      prev.map((c) =>
        c.crmContactId === contactId ? { ...c, [field]: value } : c
      )
    );
  };

  const toggleSelectAll = () => {
    const importable = filteredContacts.filter((c) => !c.inCurrentWorkspace);
    if (selected.size === importable.length && importable.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((c) => c.email)));
    }
  };

  const filteredContacts = search
    ? gmailContacts.filter(
        (c) =>
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          c.gmailName?.toLowerCase().includes(search.toLowerCase()) ||
          c.crmFirstName?.toLowerCase().includes(search.toLowerCase()) ||
          c.crmLastName?.toLowerCase().includes(search.toLowerCase())
      )
    : gmailContacts;

  const importableSelected = filteredContacts.filter(
    (c) => selected.has(c.email) && !c.inCurrentWorkspace
  ).length;

  return (
    <div className="space-y-4">
      {/* Connection header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MailIcon className="h-4 w-4" />
            Connected as <span className="font-medium text-foreground">{connection.providerAccountEmail}</span>
          </div>
          {connection.lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Last synced: {new Date(connection.lastSyncedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshSync}
            disabled={refreshing}
          >
            <RefreshCwIcon className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Sync Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            <UnplugIcon className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <ConnectionSettings
          connection={connection}
          onUpdate={() => {}}
        />
      )}

      {/* Import result */}
      {importResult && (
        <div className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-md px-4 py-2 text-sm flex items-center gap-2">
          <CheckIcon className="h-4 w-4" />
          {importResult}
          <button onClick={() => setImportResult(null)} className="ml-auto">
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Search + actions bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search contacts..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {importableSelected > 0 && (
          <Button onClick={handleImportSelected} disabled={importing}>
            <UserPlusIcon className="h-4 w-4 mr-1" />
            {importing
              ? "Importing..."
              : `Add ${importableSelected} to Workspace`}
          </Button>
        )}
      </div>

      {/* Contacts table */}
      {loadingContacts ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={
                      selected.size > 0 &&
                      selected.size ===
                        filteredContacts.filter((c) => !c.inCurrentWorkspace)
                          .length
                    }
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-center px-3 py-2 font-medium">
                  Sync Interactions
                </th>
                <th className="text-center px-3 py-2 font-medium">
                  Visible to Team
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <GmailContactRow
                  key={contact.email}
                  contact={contact}
                  selected={selected.has(contact.email)}
                  onSelect={(checked) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(contact.email);
                      else next.delete(contact.email);
                      return next;
                    });
                  }}
                  onToggleSetting={handleToggleSetting}
                />
              ))}
              {filteredContacts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    {search
                      ? "No contacts match your search."
                      : "No email contacts found. Send some emails first!"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filteredContacts.length} contacts from your sent emails.
      </p>
    </div>
  );
}

// ---------- Contact Row ----------

function GmailContactRow({
  contact,
  selected,
  onSelect,
  onToggleSetting,
}: {
  contact: GmailContact;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onToggleSetting: (
    contactId: string,
    field: "syncInteractions" | "interactionsVisible",
    value: boolean
  ) => void;
}) {
  const displayName =
    contact.crmFirstName || contact.crmLastName
      ? `${contact.crmFirstName || ""} ${contact.crmLastName || ""}`.trim()
      : contact.gmailName || "—";

  return (
    <tr
      className={`border-t ${
        contact.inCurrentWorkspace
          ? "bg-blue-50/50 dark:bg-blue-950/10"
          : ""
      }`}
    >
      <td className="px-3 py-2">
        {!contact.inCurrentWorkspace && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="rounded"
          />
        )}
      </td>
      <td className="px-3 py-2">
        {contact.crmContactId ? (
          <a
            href={`/dashboard/contacts/${contact.crmContactId}`}
            className="text-blue-600 hover:underline"
          >
            {contact.email}
          </a>
        ) : (
          contact.email
        )}
      </td>
      <td className="px-3 py-2">{displayName}</td>
      <td className="px-3 py-2 text-center">
        {contact.inCurrentWorkspace ? (
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
            In Workspace
          </span>
        ) : contact.inCrm ? (
          <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
            In CRM (other workspace)
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not in CRM</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {contact.crmContactId && contact.inCurrentWorkspace ? (
          <button
            onClick={() =>
              onToggleSetting(
                contact.crmContactId!,
                "syncInteractions",
                !contact.syncInteractions
              )
            }
            className={`inline-flex items-center justify-center rounded-full w-8 h-8 ${
              contact.syncInteractions
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {contact.syncInteractions ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {contact.crmContactId && contact.inCurrentWorkspace ? (
          <button
            onClick={() =>
              onToggleSetting(
                contact.crmContactId!,
                "interactionsVisible",
                !contact.interactionsVisible
              )
            }
            className={`inline-flex items-center justify-center rounded-full w-8 h-8 ${
              contact.interactionsVisible
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {contact.interactionsVisible ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

// ---------- Connection Settings ----------

function ConnectionSettings({
  connection,
}: {
  connection: EmailConnection;
  onUpdate: () => void;
}) {
  return (
    <div className="border rounded-md p-4 bg-muted/30 space-y-3">
      <h4 className="text-sm font-medium">Default settings for new contacts</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="text-muted-foreground">Sync interactions by default</label>
          <p className="font-medium">{connection.defaultSyncInteractions ? "Yes" : "No"}</p>
        </div>
        <div>
          <label className="text-muted-foreground">Interactions visible to team by default</label>
          <p className="font-medium">{connection.defaultInteractionsVisible ? "Yes" : "No"}</p>
        </div>
        <div>
          <label className="text-muted-foreground">Sync interval</label>
          <p className="font-medium">Every {connection.syncIntervalMinutes} minutes</p>
        </div>
      </div>
    </div>
  );
}
