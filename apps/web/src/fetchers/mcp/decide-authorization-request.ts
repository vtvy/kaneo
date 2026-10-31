import { getApiUrl } from "@/fetchers/get-api-url";

async function decideMcpAuthorizationRequest({
  requestId,
  approved,
}: {
  requestId: string;
  approved: boolean;
}) {
  const response = await fetch(
    getApiUrl(`/mcp/authorize/requests/${encodeURIComponent(requestId)}`),
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ approved }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = (await response.json()) as { redirect: string };
  return data.redirect;
}

export default decideMcpAuthorizationRequest;
