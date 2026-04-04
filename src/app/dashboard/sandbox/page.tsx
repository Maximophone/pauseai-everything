import { SandboxEmailViewer } from "@/components/sandbox-email-viewer";

export default function SandboxPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Sandbox Emails</h2>
      <p className="text-muted-foreground mt-1">
        All outbound emails captured in sandbox mode. No real emails are sent.
      </p>
      <div className="mt-6">
        <SandboxEmailViewer />
      </div>
    </div>
  );
}
