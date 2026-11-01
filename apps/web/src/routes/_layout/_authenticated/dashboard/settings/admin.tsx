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
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin",
)({
  component: RouteComponent,
});

// The role check here only hides the UI; every /api/admin route re-checks
// instance admin status on the server.
function RouteComponent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = (user as { role?: string | null } | null)?.role === "admin";

  if (!isAdmin) {
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
    },
    {
      title: t("settings:adminPanel.workspaces.title"),
      url: "/dashboard/settings/admin/workspaces",
      icon: Building2,
    },
    {
      title: t("settings:adminPanel.instanceSettings.title"),
      url: "/dashboard/settings/admin/settings",
      icon: SlidersHorizontal,
    },
    {
      title: t("settings:adminPanel.system.title"),
      url: "/dashboard/settings/admin/system",
      icon: Activity,
    },
    {
      title: t("settings:adminPanel.auditLog.title"),
      url: "/dashboard/settings/admin/audit-log",
      icon: ScrollText,
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
                {menuItems.map((item) => (
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
        <Outlet />
      </div>
    </div>
  );
}
