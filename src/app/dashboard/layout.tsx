import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "@/components/session-provider"
import { WorkspaceProvider, type WorkspaceInfo } from "@/components/workspace-provider"
import type { UserRole } from "@/db/schema/users"
import { listWorkspaces, getUserWorkspaces } from "@/lib/workspaces"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const devBypass = process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";

  let user = {
    name: "Dev User",
    email: "dev@pauseai.info",
    avatar: "",
    role: "admin" as UserRole,
  };

  let initialWorkspaces: WorkspaceInfo[] = [];

  if (!devBypass) {
    const session = await auth()

    if (!session?.user) {
      redirect("/login")
    }

    user = {
      name: session.user.name ?? "User",
      email: session.user.email ?? "",
      avatar: session.user.image ?? "",
      // @ts-expect-error - role is added in auth callbacks
      role: (session.user.role as UserRole) ?? "viewer",
    };

    // Get workspaces for this user
    if (user.role === "admin") {
      // Admins see all workspaces
      const all = await listWorkspaces();
      initialWorkspaces = all.map((ws) => ({
        ...ws,
        type: ws.type as "global" | "chapter",
        workspaceRole: "admin",
      }));
    } else if (session.user.id) {
      const userWs = await getUserWorkspaces(session.user.id);
      initialWorkspaces = userWs.map((ws) => ({
        ...ws,
        type: ws.type as "global" | "chapter",
      }));
    }
  } else {
    // Dev bypass: load all workspaces
    const all = await listWorkspaces();
    initialWorkspaces = all.map((ws) => ({
      ...ws,
      type: ws.type as "global" | "chapter",
      workspaceRole: "admin",
    }));
  }

  return (
    <SessionProvider>
      <WorkspaceProvider initialWorkspaces={initialWorkspaces}>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar user={user} />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                />
                <h1 className="text-sm font-medium">PauseAI CRM</h1>
              </header>
              <main className="flex-1 p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </WorkspaceProvider>
    </SessionProvider>
  )
}
