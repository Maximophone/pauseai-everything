"use client";

import { useState } from "react";

type Props = {
  initialSettings: Record<string, string>;
};

export function EmailSettings({ initialSettings }: Props) {
  const [listUnsubscribeEnabled, setListUnsubscribeEnabled] = useState(
    initialSettings["mailersend_list_unsubscribe_enabled"] === "true"
  );
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const newValue = !listUnsubscribeEnabled;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailersend_list_unsubscribe_enabled: newValue ? "true" : "false",
        }),
      });
      if (res.ok) {
        setListUnsubscribeEnabled(newValue);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">RFC 8058 List-Unsubscribe Header</h4>
          <p className="text-sm text-muted-foreground mt-1">
            When enabled, campaign emails include a <code>List-Unsubscribe</code> header
            that lets email clients (Gmail, Apple Mail, etc.) show a native unsubscribe
            button. <strong>Requires Mailersend Professional+ plan</strong> &mdash; enabling
            this on a lower plan will cause email sends to fail.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            The <code>{"{{unsubscribe}}"}</code> merge variable in the email body works
            regardless of this setting.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            listUnsubscribeEnabled ? "bg-primary" : "bg-gray-200"
          } ${saving ? "opacity-50" : ""}`}
          role="switch"
          aria-checked={listUnsubscribeEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              listUnsubscribeEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {listUnsubscribeEnabled && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm text-amber-800">
            Make sure your Mailersend account is on the Professional+ plan before
            sending campaigns, otherwise emails will fail to send.
          </p>
        </div>
      )}
    </div>
  );
}
