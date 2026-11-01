import { useEffect } from "react";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { useInstanceNameStore } from "@/store/instance-name";

/** Copies the admin-configured instance name into the page-title store. */
export function InstanceNameSync() {
  const { data } = useGetConfig();
  const setInstanceName = useInstanceNameStore(
    (state) => state.setInstanceName,
  );
  const instanceName = data?.instanceName;

  useEffect(() => {
    if (instanceName) setInstanceName(instanceName);
  }, [instanceName, setInstanceName]);

  return null;
}
