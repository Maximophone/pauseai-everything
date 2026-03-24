"use client";

import { useWorkspace, type WorkspaceInfo } from "./workspace-provider";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Globe, MapPin } from "lucide-react";

function WorkspaceIcon({ ws }: { ws: WorkspaceInfo }) {
  return (
    <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
      {ws.type === "global" ? (
        <Globe className="size-4" />
      ) : (
        ws.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace, isLoading } =
    useWorkspace();
  const { isMobile } = useSidebar();

  if (isLoading || !activeWorkspace) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
              P
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">PauseAI</span>
              <span className="truncate text-xs text-muted-foreground">
                Loading...
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Single workspace — no switcher needed
  if (workspaces.length <= 1) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" render={<a href="/dashboard" />}>
            <WorkspaceIcon ws={activeWorkspace} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {activeWorkspace.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {activeWorkspace.type === "global" ? "Global" : "Chapter"}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // Multiple workspaces — show switcher dropdown
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <WorkspaceIcon ws={activeWorkspace} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {activeWorkspace.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {activeWorkspace.type === "global" ? "Global" : "Chapter"}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => {
                    if (ws.id !== activeWorkspace.id) {
                      setActiveWorkspace(ws);
                    }
                  }}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    {ws.type === "global" ? (
                      <Globe className="size-4 shrink-0" />
                    ) : (
                      <MapPin className="size-4 shrink-0" />
                    )}
                  </div>
                  <span className="flex-1">{ws.name}</span>
                  {ws.id === activeWorkspace.id && (
                    <span className="text-xs text-muted-foreground">Active</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
