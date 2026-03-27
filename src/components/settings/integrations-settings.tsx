"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircleIcon, AlertCircleIcon, EyeIcon, EyeOffIcon } from "lucide-react";

type SaveState = "idle" | "saving" | "saved" | "error";

export function IntegrationsSettings() {
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          // API key is masked — don't populate the field, just note if one exists
          if (data["mailersend_api_key"]) {
            setHasExistingKey(true);
          }
          if (data["mailersend_from_email"]) {
            setFromEmail(data["mailersend_from_email"]);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("saving");
    setErrorMsg("");

    const body: Record<string, string> = {};
    // Only send the API key if the user typed something new
    if (apiKey) body["mailersend_api_key"] = apiKey;
    if (fromEmail) body["mailersend_from_email"] = fromEmail;

    if (Object.keys(body).length === 0) {
      setSaveState("idle");
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveState("saved");
        if (apiKey) {
          setHasExistingKey(true);
          setApiKey(""); // Clear so the placeholder shows again
        }
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to save");
        setSaveState("error");
      }
    } catch {
      setErrorMsg("Network error");
      setSaveState("error");
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* MailerSend section */}
      <div className="rounded-lg border p-6 space-y-5">
        <div>
          <h3 className="font-medium">MailerSend</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Used for sending invitation emails and ticket notifications.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mailersend-api-key">API Key</Label>
          <div className="relative">
            <Input
              id="mailersend-api-key"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasExistingKey ? "••••••••••••  (key saved — enter new value to replace)" : "mlsn.xxxxxxxxxxxxxxxx"}
              className="pr-10 font-mono text-sm"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showApiKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate a token in your{" "}
            <a
              href="https://app.mailersend.com/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              MailerSend dashboard
            </a>
            . Make sure it has <em>Full access</em> or at least <em>Email sending</em> permission.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mailersend-from-email">From Email Address</Label>
          <Input
            id="mailersend-from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="noreply@yourdomain.com"
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            Must be a verified sender domain in MailerSend.
          </p>
        </div>
      </div>

      {/* Save button + status */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : "Save"}
        </Button>
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircleIcon className="h-4 w-4" /> Saved
          </span>
        )}
        {saveState === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircleIcon className="h-4 w-4" /> {errorMsg}
          </span>
        )}
      </div>
    </form>
  );
}
