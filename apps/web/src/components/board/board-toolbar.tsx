import { Filter, PanelsTopLeft, Rows3, Search } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import ActiveFilterChip from "@/components/common/active-filter-chip";
import SortControl from "@/components/common/sort-control";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import {
  type BoardFilters,
  DUE_DATE_FILTER_VALUES,
} from "@/hooks/use-task-filters";
import { getColumnIcon } from "@/lib/column";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import type { SortConfig } from "@/lib/sort-tasks";
import type { ProjectWithTasks } from "@/types/project";

type WorkspaceLabel = {
  id: string;
  name: string;
  color: string;
};

type ActiveUsers = {
  members?: Array<{
    userId: string;
    user?: {
      image?: string | null;
      name?: string | null;
    } | null;
  }>;
};

type BoardToolbarProps = {
  project?: ProjectWithTasks | null;
  filters: BoardFilters;
  updateFilter: (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => void;
  updateLabelFilter: (labelId: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  users?: ActiveUsers;
  workspaceLabels: WorkspaceLabel[];
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
};

function CheckSlot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-lg border ${
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      }`}
    >
      {checked ? "✓" : null}
    </span>
  );
}

function StackedIcons({
  items,
  itemClassName,
}: {
  items: Array<{ id: string; node: ReactNode }>;
  itemClassName?: string;
}) {
  if (items.length === 0) return null;

  return (
    <span className="inline-flex items-center -space-x-1.5">
      {items.slice(0, 3).map((item) => (
        <span
          key={item.id}
          className={`inline-flex size-4 items-center justify-center rounded-full bg-background ${itemClassName ?? ""}`}
        >
          {item.node}
        </span>
      ))}
    </span>
  );
}

export default function BoardToolbar({
  project,
  filters,
  updateFilter,
  updateLabelFilter,
  clearFilters,
  hasActiveFilters,
  users,
  workspaceLabels,
  viewMode,
  setViewMode,
  sort,
  onSortChange,
  searchQuery,
  onSearchQueryChange,
  searchInputRef,
}: BoardToolbarProps) {
  const { t } = useTranslation();
  const selectedStatusIds = filters.status ?? [];
  const selectedPriorityIds = filters.priority ?? [];
  const selectedAssigneeIds = filters.assignee ?? [];
  const selectedCreatorIds = filters.creator ?? [];
  const selectedDueDateFilters = filters.dueDate ?? [];

  const getStatusDisplayName = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return column?.name || statusId;
  };
  const getStatusIcon = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return getColumnIcon(statusId, column?.isFinal, column?.icon);
  };

  const getPriorityDisplayName = (priority: string) =>
    getPriorityLabel(priority);

  const getAssigneeDisplayName = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return member?.user?.name || t("common:people.unknown");
  };
  const getAssigneeAvatar = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return (
      <Avatar className="h-4 w-4">
        <AvatarImage
          src={member?.user?.image ?? ""}
          alt={member?.user?.name || ""}
        />
        <AvatarFallback className="border border-border/30 text-[9px] font-medium">
          {member?.user?.name?.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
    );
  };

  const uniqueLabels = workspaceLabels.reduce(
    (acc: WorkspaceLabel[], label: WorkspaceLabel) => {
      const existing = acc.find(
        (l) => l.name === label.name && l.color === label.color,
      );
      if (!existing) acc.push(label);
      return acc;
    },
    [],
  );

  const isLabelGroupSelected = (label: { name: string; color: string }) => {
    return workspaceLabels
      .filter((l) => l.name === label.name && l.color === label.color)
      .some((l) => filters.labels?.includes(l.id));
  };

  const toggleStatusFilter = (statusId: string) => {
    const exists = selectedStatusIds.includes(statusId);
    const next = exists
      ? selectedStatusIds.filter((id) => id !== statusId)
      : [...selectedStatusIds, statusId];
    updateFilter("status", next.length > 0 ? next : null);
  };

  const togglePriorityFilter = (priority: string) => {
    const exists = selectedPriorityIds.includes(priority);
    const next = exists
      ? selectedPriorityIds.filter((id) => id !== priority)
      : [...selectedPriorityIds, priority];
    updateFilter("priority", next.length > 0 ? next : null);
  };

  const toggleAssigneeFilter = (userId: string) => {
    const exists = selectedAssigneeIds.includes(userId);
    const next = exists
      ? selectedAssigneeIds.filter((id) => id !== userId)
      : [...selectedAssigneeIds, userId];
    updateFilter("assignee", next.length > 0 ? next : null);
  };

  const toggleCreatorFilter = (userId: string) => {
    const exists = selectedCreatorIds.includes(userId);
    const next = exists
      ? selectedCreatorIds.filter((id) => id !== userId)
      : [...selectedCreatorIds, userId];
    updateFilter("creator", next.length > 0 ? next : null);
  };

  const toggleDueDateFilter = (dueDate: string) => {
    const exists = selectedDueDateFilters.includes(dueDate);
    const next = exists
      ? selectedDueDateFilters.filter((id) => id !== dueDate)
      : [...selectedDueDateFilters, dueDate];
    updateFilter("dueDate", next.length > 0 ? next : null);
  };

  const toggleLabelGroup = (label: { name: string; color: string }) => {
    const matching = workspaceLabels.filter(
      (l) => l.name === label.name && l.color === label.color,
    );
    const anySelected = matching.some((l) => filters.labels?.includes(l.id));

    for (const l of matching) {
      if (
        (anySelected && filters.labels?.includes(l.id)) ||
        (!anySelected && !filters.labels?.includes(l.id))
      ) {
        updateLabelFilter(l.id);
      }
    }
  };

  const clearLabelFilters = () => {
    if (!filters.labels || filters.labels.length === 0) return;
    for (const labelId of filters.labels) updateLabelFilter(labelId);
  };

  return (
    <div className="border-border/80 border-b bg-card/80 backdrop-blur supports-backdrop-filter:bg-card/70">
      <div className="flex min-h-10 items-center px-2 py-1.5 md:px-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative w-55 max-w-full">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={t("tasks:boardSearchPlaceholder")}
                className="h-7 **:data-[slot=input]:h-7 **:data-[slot=input]:leading-7 **:data-[slot=input]:pl-8 **:data-[slot=input]:text-xs **:data-[slot=input]:placeholder:text-xs"
                aria-label={t("tasks:boardSearchPlaceholder")}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-foreground text-xs font-medium outline-none ring-0 hover:bg-accent/60"
                  />
                }
              >
                <Filter className="h-3 w-3" />
                {t("common:actions.filter")}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                    {t("tasks:boardFilters.filterBy")}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <button
                  className={`mx-1 mb-1 inline-flex h-8 w-[calc(100%-0.5rem)] items-center gap-1.5 rounded-md px-2 text-left text-sm ${
                    filters.relatedToMe
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                  }`}
                  onClick={() =>
                    updateFilter(
                      "relatedToMe",
                      filters.relatedToMe ? null : true,
                    )
                  }
                  type="button"
                >
                  <CheckSlot checked={!!filters.relatedToMe} />
                  {t("tasks:boardFilters.subjects.relatedToMe")}
                </button>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    {t("tasks:boardFilters.subjects.status")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-72">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedStatusIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("status", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedStatusIds.length === 0} />
                        {t("tasks:boardFilters.allStatuses")}
                      </button>
                      {project?.columns?.map((column) => (
                        <button
                          key={column.id}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedStatusIds.includes(column.id)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => toggleStatusFilter(column.id)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedStatusIds.includes(column.id)}
                          />
                          <span className="inline-flex h-4 w-4 items-center justify-center">
                            {getStatusIcon(column.id)}
                          </span>
                          <span className="truncate">{column.name}</span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    {t("tasks:boardFilters.subjects.priority")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-72">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedPriorityIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("priority", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedPriorityIds.length === 0} />
                        {t("tasks:boardFilters.allPriorities")}
                      </button>
                      {["urgent", "high", "medium", "low"].map((priority) => (
                        <button
                          key={priority}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedPriorityIds.includes(priority)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => togglePriorityFilter(priority)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedPriorityIds.includes(priority)}
                          />
                          <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
                            {getPriorityIcon(priority)}
                          </span>
                          <span className="truncate capitalize">
                            {getPriorityDisplayName(priority)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    {t("tasks:boardFilters.subjects.assignee")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedAssigneeIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("assignee", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedAssigneeIds.length === 0} />
                        {t("tasks:boardFilters.allAssignees")}
                      </button>
                      {users?.members?.map((member) => (
                        <button
                          key={member.userId}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedAssigneeIds.includes(member.userId)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => toggleAssigneeFilter(member.userId)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedAssigneeIds.includes(
                              member.userId,
                            )}
                          />
                          <span className="inline-flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={member.user?.image ?? ""}
                                alt={member.user?.name || ""}
                              />
                              <AvatarFallback className="border border-border/30 text-[10px] font-medium">
                                {member.user?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.user?.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    {t("tasks:boardFilters.subjects.creator")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedCreatorIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("creator", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedCreatorIds.length === 0} />
                        {t("tasks:boardFilters.allCreators")}
                      </button>
                      {users?.members?.map((member) => (
                        <button
                          key={member.userId}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedCreatorIds.includes(member.userId)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => toggleCreatorFilter(member.userId)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedCreatorIds.includes(member.userId)}
                          />
                          <span className="inline-flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={member.user?.image ?? ""}
                                alt={member.user?.name || ""}
                              />
                              <AvatarFallback className="border border-border/30 text-[10px] font-medium">
                                {member.user?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.user?.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    {t("tasks:boardFilters.subjects.dueDate")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedDueDateFilters.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("dueDate", null)}
                        type="button"
                      >
                        <CheckSlot
                          checked={selectedDueDateFilters.length === 0}
                        />
                        {t("tasks:boardFilters.allDueDates")}
                      </button>
                      {[
                        DUE_DATE_FILTER_VALUES.dueThisWeek,
                        DUE_DATE_FILTER_VALUES.dueNextWeek,
                        DUE_DATE_FILTER_VALUES.noDueDate,
                      ].map((dueDate) => (
                        <button
                          key={dueDate}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedDueDateFilters.includes(dueDate)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => toggleDueDateFilter(dueDate)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedDueDateFilters.includes(dueDate)}
                          />
                          {t(
                            `tasks:backlog.filters.${
                              dueDate === DUE_DATE_FILTER_VALUES.dueThisWeek
                                ? "dueThisWeek"
                                : dueDate === DUE_DATE_FILTER_VALUES.dueNextWeek
                                  ? "dueNextWeek"
                                  : "noDueDate"
                            }`,
                          )}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    {t("tasks:properties.labels")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    <DropdownMenuItem
                      onClick={clearLabelFilters}
                      className="h-8 rounded-md text-sm"
                    >
                      <CheckSlot
                        checked={!filters.labels || filters.labels.length === 0}
                      />
                      {t("tasks:boardFilters.allLabels")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {uniqueLabels.length > 0 ? (
                      uniqueLabels.map((label) => (
                        <DropdownMenuItem
                          key={label.id}
                          onClick={() => toggleLabelGroup(label)}
                          className="h-8 rounded-md text-sm"
                        >
                          <CheckSlot checked={isLabelGroupSelected(label)} />
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                labelColors.find((c) => c.value === label.color)
                                  ?.color || "var(--color-neutral-400)",
                            }}
                          />
                          <span className="max-w-20 truncate">
                            {label.name}
                          </span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem
                        disabled
                        className="h-8 rounded-md text-sm text-muted-foreground"
                      >
                        {t("tasks:labels.empty")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={clearFilters}
                      className="h-8 rounded-md text-sm text-muted-foreground"
                    >
                      {t("common:actions.clearAllFilters")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <SortControl sort={sort} onSortChange={onSortChange} />

            {filters.relatedToMe && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.relatedToMe")}
                onClear={() => updateFilter("relatedToMe", null)}
              />
            )}

            {selectedStatusIds.length > 0 && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.status")}
                operator={t("tasks:boardFilters.operators.isAnyOf")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedStatusIds.map((statusId) => ({
                        id: statusId,
                        node: getStatusIcon(statusId),
                      }))}
                      itemClassName="[&>svg]:h-3.5 [&>svg]:w-3.5"
                    />
                    <span>
                      {selectedStatusIds.length === 1
                        ? getStatusDisplayName(selectedStatusIds[0])
                        : t("tasks:boardFilters.selectedCount", {
                            count: selectedStatusIds.length,
                          })}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("status", null)}
              />
            )}

            {selectedPriorityIds.length > 0 && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.priority")}
                operator={t("tasks:boardFilters.operators.isAnyOf")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedPriorityIds.map((priority) => ({
                        id: priority,
                        node: getPriorityIcon(priority),
                      }))}
                    />
                    <span>
                      {selectedPriorityIds.length === 1
                        ? getPriorityDisplayName(selectedPriorityIds[0])
                        : t("tasks:boardFilters.selectedCount", {
                            count: selectedPriorityIds.length,
                          })}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("priority", null)}
              />
            )}

            {selectedAssigneeIds.length > 0 && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.assignee")}
                operator={t("tasks:boardFilters.operators.isAnyOf")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedAssigneeIds.map((userId) => ({
                        id: userId,
                        node: getAssigneeAvatar(userId),
                      }))}
                    />
                    <span>
                      {selectedAssigneeIds.length === 1
                        ? getAssigneeDisplayName(selectedAssigneeIds[0])
                        : t("tasks:boardFilters.selectedCount", {
                            count: selectedAssigneeIds.length,
                          })}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("assignee", null)}
              />
            )}

            {selectedCreatorIds.length > 0 && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.creator")}
                operator={t("tasks:boardFilters.operators.isAnyOf")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedCreatorIds.map((userId) => ({
                        id: userId,
                        node: getAssigneeAvatar(userId),
                      }))}
                    />
                    <span>
                      {selectedCreatorIds.length === 1
                        ? getAssigneeDisplayName(selectedCreatorIds[0])
                        : t("tasks:boardFilters.selectedCount", {
                            count: selectedCreatorIds.length,
                          })}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("creator", null)}
              />
            )}

            {selectedDueDateFilters.length > 0 && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.dueDate")}
                operator={t("tasks:boardFilters.operators.isAnyOf")}
                value={
                  selectedDueDateFilters.length === 1
                    ? t(
                        `tasks:backlog.filters.${
                          selectedDueDateFilters[0] ===
                          DUE_DATE_FILTER_VALUES.dueThisWeek
                            ? "dueThisWeek"
                            : selectedDueDateFilters[0] ===
                                DUE_DATE_FILTER_VALUES.dueNextWeek
                              ? "dueNextWeek"
                              : "noDueDate"
                        }`,
                      )
                    : t("tasks:boardFilters.selectedCount", {
                        count: selectedDueDateFilters.length,
                      })
                }
                onClear={() => updateFilter("dueDate", null)}
              />
            )}

            {filters.labels && filters.labels.length > 0 && (
              <ActiveFilterChip
                subject={t("tasks:boardFilters.subjects.labels")}
                operator={t("tasks:boardFilters.operators.includeAnyOf")}
                value={t("tasks:boardFilters.selectedCount", {
                  count: filters.labels.length,
                })}
                onClear={clearLabelFilters}
              />
            )}
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                viewMode === "board"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
              onClick={() => setViewMode("board")}
            >
              <PanelsTopLeft className="h-3 w-3" />
              {t("tasks:view.board")}
            </button>
            <button
              type="button"
              className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
              onClick={() => setViewMode("list")}
            >
              <Rows3 className="h-3 w-3" />
              {t("tasks:view.list")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
