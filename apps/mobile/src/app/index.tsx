import { Redirect } from "expo-router";
import { Loading } from "@/components/ui";
import { useSession } from "@/lib/session";

export default function Index() {
  const { ready, session } = useSession();
  if (!ready) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href="/workspaces" />;
}
