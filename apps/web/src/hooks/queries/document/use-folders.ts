import { useQuery } from "@tanstack/react-query";
import getFolders from "@/fetchers/document/get-folders";

function useFolders(projectId?: string) {
  return useQuery({
    queryKey: ["folders", projectId],
    enabled: Boolean(projectId),
    queryFn: () => getFolders(projectId as string),
  });
}

export default useFolders;
