import { useMutation } from "@tanstack/react-query";
import { listImportSourceProjects } from "@/fetchers/import/import";

export function useListImportSourceProjects() {
  return useMutation({ mutationFn: listImportSourceProjects });
}
