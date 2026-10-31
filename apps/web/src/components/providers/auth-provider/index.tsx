import { createContext, type PropsWithChildren, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";
import { LoadingSkeleton } from "../../ui/loading-skeleton";

const { useSession } = authClient;

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
}>({
  user: undefined,
  isLoading: true,
});

function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending, error } = useSession();
  const lastUser = useRef<User | null>(null);
  // Preserve presentation state on transient failures, but never grant access
  // from this cache: route guards still require a successful session check.
  if (error?.status === 401 || error?.status === 403) {
    lastUser.current = null;
  } else if (!isPending && !error) {
    lastUser.current = (data?.user as User | null | undefined) ?? null;
  }
  // Only show the loading skeleton during the *first* session fetch. Better
  // Auth re-fetches the session on window focus; if we kept returning the
  // skeleton while those background fetches are pending we'd unmount the
  // entire route tree on every alt-tab — which tore down the Turnstile
  // iframe and forced a re-challenge.
  const hasLoadedOnce = useRef(false);
  if (!isPending) {
    hasLoadedOnce.current = true;
  }

  if (isPending && !hasLoadedOnce.current) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: lastUser.current,
        isLoading: isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
