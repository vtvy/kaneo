import type { ImportConnection } from "@kaneo/importers";
import type { ImportConnectionInput } from "../schema";

export type ResolvedImportConnection = {
  connection: ImportConnection;
  secrets: string[];
  credentialHint: string;
};

export function resolveImportConnection(
  input: ImportConnectionInput,
): ResolvedImportConnection {
  switch (input.source) {
    case "planka": {
      const { source, url, apiKey, username, password } = input;
      return {
        connection: {
          source,
          url,
          ...(apiKey ? { apiKey } : { username, password }),
        },
        secrets: [apiKey, password].filter(isPresent),
        credentialHint: apiKey
          ? "Check the API key."
          : "Check the username and password.",
      };
    }
    case "jira":
      return {
        connection: input,
        secrets: [input.apiToken],
        credentialHint:
          "Check the email and API token, or the personal access token for Jira Data Center.",
      };
  }
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}
