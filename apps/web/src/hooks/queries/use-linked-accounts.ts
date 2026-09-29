import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

function useLinkedAccounts() {
  return useQuery({
    queryKey: ["linked-accounts"],
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

export default useLinkedAccounts;
