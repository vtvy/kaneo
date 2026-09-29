import { useQuery } from "@tanstack/react-query";
import getSprint from "@/fetchers/sprint/get-sprint";

function useGetSprint(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["sprint", id],
    queryFn: () => getSprint({ id }),
  });
}

export default useGetSprint;
