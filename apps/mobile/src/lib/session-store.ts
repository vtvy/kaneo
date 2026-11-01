import * as SecureStore from "expo-secure-store";
import type { SessionCredential } from "@/lib/auth-credential";
import type { CurrentUser } from "@/lib/types";

const SESSION_KEY = "kaneo.session";
const SERVER_KEY = "kaneo.serverUrl";

export type Session = {
  serverUrl: string;
  credential: SessionCredential;
  user: CurrentUser;
};

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.serverUrl || !parsed.credential || !parsed.user?.id)
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  await SecureStore.setItemAsync(SERVER_KEY, session.serverUrl);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function loadLastServerUrl(): Promise<string> {
  return (await SecureStore.getItemAsync(SERVER_KEY)) ?? "";
}
