import { useEffect, useState } from "react";
import { ALL_SPRINTS_VALUE } from "@/components/sprint/board-sprint-filter";

export function useBoardSprintFilter(
  projectId: string,
  sprints: { id: string }[] | undefined,
  currentSprintId: string | undefined,
) {
  const sprintFilterStorageKey = `kaneo:board-sprint-filter:${projectId}`;
  const [selectedSprintId, setSelectedSprintId] =
    useState<string>(ALL_SPRINTS_VALUE);
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(
    null,
  );
  const hasInitializedSprintFilter = hydratedProjectId === projectId;

  // Hydrate once sprints load: prefer stored selection, else current sprint.
  useEffect(() => {
    if (hasInitializedSprintFilter || !sprints) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(sprintFilterStorageKey);
    } catch {
      stored = null;
    }
    const storedIsValid =
      stored === ALL_SPRINTS_VALUE ||
      (typeof stored === "string" &&
        sprints.some((sprint) => sprint.id === stored));
    setSelectedSprintId(
      storedIsValid
        ? (stored as string)
        : (currentSprintId ?? ALL_SPRINTS_VALUE),
    );
    setHydratedProjectId(projectId);
  }, [
    sprints,
    currentSprintId,
    hasInitializedSprintFilter,
    sprintFilterStorageKey,
    projectId,
  ]);

  // Persist selection after hydrate.
  useEffect(() => {
    if (!hasInitializedSprintFilter || !sprints) return;
    try {
      window.localStorage.setItem(sprintFilterStorageKey, selectedSprintId);
    } catch {
      // ignore quota / private mode
    }
  }, [
    selectedSprintId,
    sprintFilterStorageKey,
    hasInitializedSprintFilter,
    sprints,
  ]);

  // If the selected sprint no longer exists (e.g. deleted), fall back to "all".
  useEffect(() => {
    if (
      !hasInitializedSprintFilter ||
      selectedSprintId === ALL_SPRINTS_VALUE ||
      !sprints
    )
      return;
    if (!sprints.some((sprint) => sprint.id === selectedSprintId)) {
      setSelectedSprintId(ALL_SPRINTS_VALUE);
    }
  }, [sprints, selectedSprintId, hasInitializedSprintFilter]);

  return {
    selectedSprintId: hasInitializedSprintFilter
      ? selectedSprintId
      : ALL_SPRINTS_VALUE,
    setSelectedSprintId,
  };
}
