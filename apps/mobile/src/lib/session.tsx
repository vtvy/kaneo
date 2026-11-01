import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Session,
  setApiSession,
  signInWithApiKey,
  signInWithPassword,
  signOutFromServer,
} from "@/lib/api";
import {
  clearSession,
  loadLastServerUrl,
  loadSession,
} from "@/lib/session-store";

type SessionContextValue = {
  ready: boolean;
  session: Session | null;
  lastServerUrl: string;
  signInPassword: (
    serverUrl: string,
    email: string,
    password: string,
  ) => Promise<void>;
  signInApiKey: (serverUrl: string, apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [lastServerUrl, setLastServerUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSession(), loadLastServerUrl()])
      .then(([stored, serverUrl]) => {
        if (cancelled) return;
        setApiSession(stored);
        setSession(stored);
        setLastServerUrl(serverUrl);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signInPassword = useCallback(
    async (serverUrl: string, email: string, password: string) => {
      const next = await signInWithPassword(serverUrl, email, password);
      setSession(next);
      setLastServerUrl(next.serverUrl);
    },
    [],
  );

  const signInApiKey = useCallback(
    async (serverUrl: string, apiKey: string) => {
      const next = await signInWithApiKey(serverUrl, apiKey);
      setSession(next);
      setLastServerUrl(next.serverUrl);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await signOutFromServer();
    setApiSession(null);
    setSession(null);
    await clearSession();
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      lastServerUrl,
      signInPassword,
      signInApiKey,
      signOut,
    }),
    [ready, session, lastServerUrl, signInPassword, signInApiKey, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession phải nằm trong SessionProvider.");
  }
  return value;
}
