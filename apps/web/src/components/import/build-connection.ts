import type { ImportConnection } from "@/fetchers/import/import";

export const IMPORT_SOURCES = ["planka", "jira"] as const;

export type ImportSourceId = (typeof IMPORT_SOURCES)[number];

export type PlankaSignIn = "apiKey" | "password";

export type ImportConnectValues = {
  url: string;
  apiKey: string;
  token: string;
  username: string;
  email: string;
  password: string;
  plankaSignIn: PlankaSignIn;
};

export const EMPTY_CONNECT_VALUES: ImportConnectValues = {
  url: "",
  apiKey: "",
  token: "",
  username: "",
  email: "",
  password: "",
  plankaSignIn: "apiKey",
};

// The connection the API expects, or null while required fields are empty.
export function buildConnection(
  source: ImportSourceId,
  values: ImportConnectValues,
): ImportConnection | null {
  const url = values.url.trim();
  const apiKey = values.apiKey.trim();
  const token = values.token.trim();
  const username = values.username.trim();
  const email = values.email.trim();

  switch (source) {
    case "jira":
      if (!url || !token) return null;
      return email
        ? { source, url, email, apiToken: token }
        : { source, url, apiToken: token };
    case "planka":
      if (!url) return null;
      if (values.plankaSignIn === "apiKey") {
        return apiKey ? { source, url, apiKey } : null;
      }
      return username && values.password
        ? { source, url, username, password: values.password }
        : null;
    default:
      return null;
  }
}
