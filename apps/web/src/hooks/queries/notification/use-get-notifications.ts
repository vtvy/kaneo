import { useQuery } from "@tanstack/react-query";
import getNotifications from "@/fetchers/notification/get-notifications";

function useGetNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export default useGetNotifications;
