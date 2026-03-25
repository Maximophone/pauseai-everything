import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServerWorkspaceId } from "@/lib/workspace-server";
import { getEffectiveRole } from "@/lib/workspaces";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const devBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "true";

  if (!devBypass) {
    const session = await auth();
    // @ts-expect-error - role is added in auth callbacks
    const globalRole = session?.user?.role ?? "viewer";
    const userId = (session?.user as { id?: string })?.id;

    // Use effective role (max of global and workspace role)
    let effectiveRole = globalRole;
    if (userId) {
      const workspaceId = await getServerWorkspaceId();
      effectiveRole = await getEffectiveRole(userId, workspaceId);
    }

    if (effectiveRole !== "admin") {
      redirect("/dashboard");
    }
  }

  return <>{children}</>;
}
