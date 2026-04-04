"use client";

import { useEffect, useState } from "react";

export function SandboxBanner() {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sandbox/status")
      .then((r) => r.json())
      .then((data) => setMode(data.mode))
      .catch(() => setMode(null));
  }, []);

  if (mode !== "sandbox") return null;

  return (
    <div className="bg-amber-500 text-amber-950 text-center text-sm font-medium py-1.5 px-4 sticky top-0 z-50">
      ⚠️ SANDBOX MODE — No emails are being sent. All outbound email is captured locally.
    </div>
  );
}
