"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  UsersIcon,
  TagsIcon,
  MailIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldIcon,
  WebhookIcon,
  FilterIcon,
  ZapIcon,
  PlugIcon,
} from "lucide-react"

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
      ],
    },
    {
      title: "Tags",
      url: "/dashboard/tags",
      icon: (<TagsIcon />),
    },
    {
      title: "Segments",
      url: "/dashboard/segments",
      icon: (<FilterIcon />),
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
      title: "Settings",
      url: "/dashboard/settings",
      icon: (<SettingsIcon />),
      adminOnly: true,
      items: [
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
          title: "Connections",
          url: "/dashboard/settings/connections",
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
  const isAdmin = user.role === "admin";
  const navItems = isAdmin
    ? allNavItems
    : allNavItems.filter((item) => !("adminOnly" in item && item.adminOnly));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/dashboard" />}>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
                P
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">PauseAI</span>
                <span className="truncate text-xs text-muted-foreground">CRM</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
