import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { Button } from "@/components/ui/button";
import decideMcpAuthorizationRequest from "@/fetchers/mcp/decide-authorization-request";
import getMcpAuthorizationRequest from "@/fetchers/mcp/get-authorization-request";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const authorizeSearchSchema = z.object({
  request_id: z.string().optional(),
});

export const Route = createFileRoute("/mcp/authorize")({
  component: McpAuthorizePage,
  validateSearch: authorizeSearchSchema,
});

function McpAuthorizePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/mcp/authorize" });
  const requestId = search.request_id ?? "";
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const request = useQuery({
    queryKey: ["mcp-authorization-request", requestId],
    queryFn: () => getMcpAuthorizationRequest(requestId),
    enabled: Boolean(requestId),
    retry: false,
  });

  const decision = useMutation({
    mutationFn: decideMcpAuthorizationRequest,
    onSuccess: (redirect) => window.location.assign(redirect),
    onError: () => toast.error("Could not complete the request"),
  });

  if (!requestId || request.isError) {
    return (
      <AuthLayout
        title="Request expired"
        subtitle="This authorization request is invalid or has expired."
      >
        <div className="text-sm text-muted-foreground">
          Start the connection again from your MCP client.
        </div>
      </AuthLayout>
    );
  }

  if (request.isLoading || isSessionPending) {
    return (
      <AuthLayout title="Authorize MCP client" subtitle="Loading…">
        <div className="text-sm text-muted-foreground">Checking request…</div>
      </AuthLayout>
    );
  }

  if (!session?.user) {
    return (
      <AuthLayout
        title="Sign in to continue"
        subtitle="Sign in to approve or deny this MCP client."
      >
        <Button
          className="w-full"
          onClick={() =>
            void navigate({
              to: "/auth/sign-in",
              search: {
                redirect: `/mcp/authorize?request_id=${encodeURIComponent(requestId)}`,
              },
            })
          }
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Authorize MCP client"
      subtitle="An MCP client is requesting full access to your Kaneo account."
    >
      <div className="space-y-4">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">
              Client (name reported by the client)
            </dt>
            <dd className="font-medium break-words">
              {request.data?.clientName || "Unknown MCP client"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Will redirect to</dt>
            <dd className="font-mono break-all">{request.data?.redirectUri}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="break-words">{session.user.email}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Only approve if you started this connection yourself.
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={decision.isPending}
            onClick={() => decision.mutate({ requestId, approved: true })}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            disabled={decision.isPending}
            onClick={() => decision.mutate({ requestId, approved: false })}
          >
            Deny
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
