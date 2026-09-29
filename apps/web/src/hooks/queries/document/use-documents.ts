import { useQuery } from "@tanstack/react-query";
import listDocuments from "@/fetchers/document/list-documents";

function useDocuments(projectId?: string, folderId: string | null = null) {
  return useQuery({
    queryKey: ["documents", projectId, folderId],
    enabled: Boolean(projectId),
    queryFn: () => listDocuments(projectId as string, folderId),
  });
}

export default useDocuments;
