import { client } from "@kaneo/libs";
import { useQuery } from "@tanstack/react-query";

export default function useInstanceAccess() {
  return useQuery({
    queryKey: ["admin", "access"],
    queryFn: async () => {
      const response = await client.admin.access.$get();
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
}
