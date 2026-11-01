import { authClient } from "./auth-client";

/** A failed request is not evidence that the user has signed out. */
export async function getRouteSession() {
  for (let attempt = 0; ; attempt++) {
    try {
      const { data, error } = await authClient.getSession({
        fetchOptions: { timeout: 5_000, retry: 0 },
      });
      if (error?.status === 401) return null;
      if (error) throw new Error(error.message || "Session request failed");
      return data;
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 1_000 * (attempt + 1)),
      );
    }
  }
}
