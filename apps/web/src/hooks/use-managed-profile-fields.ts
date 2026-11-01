import useGetConfig from "@/hooks/queries/config/use-get-config";
import useLinkedAccounts from "@/hooks/queries/use-linked-accounts";

export function useManagedProfileFields() {
  const { data: config } = useGetConfig();
  const { data: accounts, isPending } = useLinkedAccounts();
  const linked = accounts?.some((account) => account.providerId === "custom");
  return {
    loading: !config || isPending,
    fields: linked ? (config?.managedProfileFields ?? []) : [],
  };
}
