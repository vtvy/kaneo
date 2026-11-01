import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import {
  Activity,
  Building2,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Users,
  Webhook,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useInstanceAccess from "@/hooks/queries/admin/use-instance-access";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  component: RouteComponent,
});

// This permission check controls navigation; each API route checks the
// current database permissions again on the server.
function RouteComponent() {
  const { t } = useTranslation();
  const { data: access, isLoading } = useInstanceAccess();
  const location = useLocation();
  const can = (permission: string) =>
    (access?.permissions as string[] | undefined)?.includes(permission) ??
    false;

  if (isLoading) return null;
  if (!access?.permissions.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t("settings:adminPanel.notAuthorized")}
      </p>
    );
  }

  const menuItems = [
    {
      title: t("settings:adminPanel.users"),
      url: "/dashboard/settings/admin/users",
      icon: Users,
      permission: "users:read",
    },
    {
      title: t("settings:adminPanel.workspaces.title"),
      url: "/dashboard/settings/admin/workspaces",
      icon: Building2,
      permission: "workspaces:read",
    },
    {
      title: t("settings:adminPanel.instanceSettings.title"),
      url: "/dashboard/settings/admin/settings",
      icon: SlidersHorizontal,
      permission: "instance:settings",
    },
    {
      title: t("settings:adminPanel.system.title"),
      url: "/dashboard/settings/admin/system",
      icon: Activity,
      permission: "instance:read",
    },
    {
      title: t("settings:adminPanel.auditLog.title"),
      url: "/dashboard/settings/admin/audit-log",
      icon: ScrollText,
      permission: "audit:read",
    },
    {
      title: t("settings:adminPanel.customRoles.title"),
      url: "/dashboard/settings/admin/roles",
      icon: Shield,
      permission: "roles:manage",
    },
    {
      title: t("settings:adminPanel.webhooks.title"),
      url: "/dashboard/settings/admin/webhooks",
      icon: Webhook,
      permission: "instance:settings",
    },
  ] as const;

  return (
    <div className="flex gap-6 h-full">
      <aside className="w-64 flex-shrink-0">
        <div className="p-2">
          <SidebarGroup className="gap-1 p-1">
            <SidebarGroupLabel className="h-7 px-2 text-[11px] uppercase tracking-wide text-sidebar-foreground/70">
              {t("settings:adminPanel.title")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {menuItems
                  .filter((item) => can(item.permission))
                  .map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <Button
                        render={<Link to={item.url} />}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 w-full justify-start gap-2 rounded-lg px-2 text-[11px] font-normal text-sidebar-foreground/80",
                          location.pathname === item.url &&
                            "bg-sidebar-accent text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Button>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {menuItems.some(
          (item) => item.url === location.pathname && can(item.permission),
        ) ? (
          <Outlet />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {t("settings:adminPanel.notAuthorized")}
          </p>
        )}
      </div>
    </div>
  );
}
