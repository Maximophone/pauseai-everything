"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { useWorkspace } from "@/components/workspace-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  UsersIcon,
  MailIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ZapIcon,
  PlugIcon,
  BookOpenIcon,
  LifeBuoyIcon,
} from "lucide-react"

const ROLE_LEVELS: Record<string, number> = { viewer: 0, member: 1, admin: 2 };
const LEVEL_TO_ROLE = ["viewer", "member", "admin"];

const allNavItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: (<LayoutDashboardIcon />),
    },
    {
      title: "Contacts",
      url: "/dashboard/contacts",
      icon: (<UsersIcon />),
      isActive: true,
      items: [
        {
          title: "All Contacts",
          url: "/dashboard/contacts",
        },
        {
          title: "Import",
          url: "/dashboard/contacts/import",
        },
        {
          title: "Tags",
          url: "/dashboard/tags",
        },
        {
          title: "Segments",
          url: "/dashboard/segments",
        },
      ],
    },
    {
      title: "Automations",
      url: "/dashboard/automations",
      icon: (<ZapIcon />),
    },
    {
      title: "Email",
      url: "/dashboard/email",
      icon: (<MailIcon />),
      items: [
        {
          title: "Campaigns",
          url: "/dashboard/email/campaigns",
        },
        {
          title: "Templates",
          url: "/dashboard/email/templates",
        },
      ],
    },
    {
      title: "Connections",
      url: "/dashboard/connections",
      icon: (<PlugIcon />),
      adminOnly: true,
    },
    {
      title: "Support",
      url: "/dashboard/support",
      icon: (<LifeBuoyIcon />),
    },
    {
      title: "Documentation",
      url: "/dashboard/docs",
      icon: (<BookOpenIcon />),
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: (<SettingsIcon />),
      adminOnly: true,
      items: [
        {
          title: "Workspaces",
          url: "/dashboard/settings/workspaces",
          globalAdminOnly: true,
        },
        {
          title: "Fields",
          url: "/dashboard/settings/fields",
        },
        {
          title: "Users",
          url: "/dashboard/settings/users",
        },
        {
          title: "API Keys",
          url: "/dashboard/settings/api-keys",
        },
        {
          title: "Webhooks",
          url: "/dashboard/settings/webhooks",
        },
        {
          title: "Email Categories",
          url: "/dashboard/settings/email-categories",
        },
        {
          title: "Integrations",
          url: "/dashboard/settings/integrations",
          globalAdminOnly: true,
        },
      ],
    },
  ]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string; role: string }
}) {
  const { activeWorkspace } = useWorkspace();

  // Effective role = max(global role, workspace role)
  const globalLevel = ROLE_LEVELS[user.role] ?? 0;
  const wsLevel = ROLE_LEVELS[activeWorkspace?.workspaceRole ?? "viewer"] ?? 0;
  const effectiveRole = LEVEL_TO_ROLE[Math.max(globalLevel, wsLevel)];

  const isAdmin = effectiveRole === "admin";
  const isGlobalAdmin = user.role === "admin";
  const navItems = (isAdmin
    ? allNavItems
    : allNavItems.filter((item) => !("adminOnly" in item && item.adminOnly))
  ).map((item) => {
    if (!item.items || isGlobalAdmin) return item;
    return {
      ...item,
      items: item.items.filter((sub) => !(sub as { globalAdminOnly?: boolean }).globalAdminOnly),
    };
  });

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
        <div className="px-3 pb-2 text-[10px] text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
          {process.env.NEXT_PUBLIC_GIT_SHA}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
