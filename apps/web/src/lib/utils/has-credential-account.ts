type LinkedAccount = {
  providerId: string;
};

export function hasCredentialAccount(
  accounts: LinkedAccount[] | undefined,
): boolean {
  return Boolean(
    accounts?.some((account) => account.providerId === "credential"),
  );
}
