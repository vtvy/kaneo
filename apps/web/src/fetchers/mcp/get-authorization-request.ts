import { getApiUrl } from "@/fetchers/get-api-url";

export type McpAuthorizationRequest = {
  clientName: string | null;
  redirectUri: string;
};

async function getMcpAuthorizationRequest(requestId: string) {
  const response = await fetch(
    getApiUrl(`/mcp/authorize/requests/${encodeURIComponent(requestId)}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as McpAuthorizationRequest;
}

export default getMcpAuthorizationRequest;
