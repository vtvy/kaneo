import { Link } from "@tanstack/react-router";
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  Files,
  FlaskConical,
  Folder,
  ListTree,
  Repeat,
  SquareKanban,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const projectRoute =
  "/dashboard/workspace/$workspaceId/project/$projectId" as const;

export function ProjectNavigation({
  workspaceId,
  projectId,
  projectName,
  activeView,
}: {
  workspaceId: string;
  projectId: string;
  projectName?: string;
  activeView: string;
}) {
  const { t } = useTranslation();
  const groups = [
    {
      title: "Boards",
      items: [
        {
          view: "work-items",
          title: "Work items",
          icon: ClipboardList,
          to: `${projectRoute}/work-items`,
        },
        {
          view: "board",
          title: "Boards",
          icon: SquareKanban,
          to: `${projectRoute}/board`,
        },
        {
          view: "backlog",
          title: "Backlogs",
          icon: ListTree,
          to: `${projectRoute}/backlog`,
        },
        {
          view: "sprints",
          title: "Sprints",
          icon: Repeat,
          to: `${projectRoute}/sprints`,
        },
      ],
    },
    {
      title: "Test Plans",
      items: [
        {
          view: "test-plans",
          title: "Test Plans",
          icon: FlaskConical,
          to: `${projectRoute}/test-plans`,
        },
      ],
    },
    {
      title: t("navigation:sidebar.projects"),
      items: [
        {
          view: "calendar",
          title: t("tasks:calendar.title"),
          icon: Calendar,
          to: `${projectRoute}/calendar`,
        },
        {
          view: "gantt",
          title: "Gantt",
          icon: CalendarDays,
          to: `${projectRoute}/gantt`,
        },
        {
          view: "documents",
          title: t("documents:nav.title"),
          icon: Files,
          to: `${projectRoute}/documents`,
        },
      ],
    },
  ] as const;

  return (
    <nav
      aria-label="Project navigation"
      className="min-h-0 overflow-y-auto border-t border-sidebar-border pt-2"
    >
      <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold">
        <Folder className="size-4 shrink-0" />
        <span className="truncate">{projectName ?? "Project"}</span>
      </div>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    isActive={activeView === item.view}
                    render={
                      <Link
                        to={item.to}
                        params={{ workspaceId, projectId }}
                        aria-current={
                          activeView === item.view ? "page" : undefined
                        }
                      />
                    }
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
