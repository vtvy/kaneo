import {
  Calendar,
  CalendarDays,
  Check,
  Files,
  Menu,
  Plus,
  Repeat,
  SquareKanban,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { cn } from "@/lib/cn";

type MobileProjectNavProps = {
  workspaceId: string;
  projectId: string;
  projectName?: string;
  activeView:
    | "work-items"
    | "backlog"
    | "board"
    | "calendar"
    | "gantt"
    | "sprints"
    | "documents";
  onSelectWorkItems?: () => void;
  onSelectBoard: () => void;
  onSelectBacklog: () => void;
  onSelectGantt: () => void;
  onSelectCalendar?: () => void;
  onSelectSprints: () => void;
  onSelectDocuments: () => void;
  onSelectProject: (projectId: string) => void;
  onAddProject: () => void;
};

export default function MobileProjectNav({
  workspaceId,
  projectId,
  projectName,
  activeView,
  onSelectWorkItems,
  onSelectBoard,
  onSelectBacklog,
  onSelectGantt,
  onSelectCalendar,
  onSelectSprints,
  onSelectDocuments,
  onSelectProject,
  onAddProject,
}: MobileProjectNavProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("navigation:projectList.switcherLabel")}
            className="h-7 max-w-[14rem] gap-1.5 px-2"
          />
        }
      >
        <Menu className="size-4 shrink-0" />
        <span className="truncate">
          {projectName || t("navigation:sidebar.projects")}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t("tasks:view.heading")}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {onSelectWorkItems && (
                <button
                  type="button"
                  className="rounded-md p-2 text-xs"
                  onClick={() => choose(onSelectWorkItems)}
                >
                  Work items
                </button>
              )}
              <button
                type="button"
                onClick={() => choose(onSelectBacklog)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "backlog"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                Backlogs
              </button>
              <button
                type="button"
                onClick={() => choose(onSelectBoard)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "board"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                <SquareKanban className="size-3.5" />
                Boards
              </button>
              {onSelectCalendar && (
                <button
                  type="button"
                  onClick={() => choose(onSelectCalendar)}
                  className={cn(
                    "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                    activeView === "calendar"
                      ? "border-border bg-secondary text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Calendar className="size-3.5" />
                  {t("tasks:calendar.title")}
                </button>
              )}
              <button
                type="button"
                onClick={() => choose(onSelectGantt)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "gantt"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                <CalendarDays className="size-3.5" />
                {t("tasks:view.gantt")}
              </button>
              <button
                type="button"
                onClick={() => choose(onSelectSprints)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "sprints"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                <Repeat className="size-3.5" />
                {t("tasks:view.sprints")}
              </button>
              <button
                type="button"
                onClick={() => choose(onSelectDocuments)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "documents"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                <Files className="size-3.5" />
                {t("documents:nav.title")}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t("navigation:sidebar.projects")}
            </p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {(projects ?? []).map((project) => {
                const Icon =
                  icons[project.icon as keyof typeof icons] || icons.Layout;
                const isCurrentProject = project.id === projectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => choose(() => onSelectProject(project.id))}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isCurrentProject
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="flex-1 truncate">{project.name}</span>
                    {isCurrentProject && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => choose(onAddProject)}
            className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" />
            {t("navigation:projectList.addProject")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
