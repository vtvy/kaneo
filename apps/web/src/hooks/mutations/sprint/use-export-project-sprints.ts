import { useMutation } from "@tanstack/react-query";
import exportProjectSprints from "@/fetchers/sprint/export-project-sprints";

const useExportProjectSprints = () => {
  return useMutation({
    mutationFn: (projectId: string) => exportProjectSprints(projectId),
  });
};

export default useExportProjectSprints;
