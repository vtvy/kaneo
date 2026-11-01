import { useQuery } from "@tanstack/react-query";
import getSprintReport from "@/fetchers/sprint/get-sprint-report";

function useGetSprintReport(id: string) {
  return useQuery({
    enabled: Boolean(id),
    // Nested under ["sprint", id] so completing the sprint invalidates it.
    queryKey: ["sprint", id, "report"],
    queryFn: () => getSprintReport({ id }),
  });
}

export default useGetSprintReport;
