import { describe, expect, it } from "vitest";
import { buildConnection, EMPTY_CONNECT_VALUES } from "./build-connection";

const values = (overrides: Partial<typeof EMPTY_CONNECT_VALUES>) => ({
  ...EMPTY_CONNECT_VALUES,
  ...overrides,
});

describe("buildConnection", () => {
  it("sends Jira Cloud the email with the API token", () => {
    expect(
      buildConnection(
        "jira",
        values({
          url: " https://acme.atlassian.net ",
          email: "ana@example.com",
          token: "tok",
        }),
      ),
    ).toEqual({
      source: "jira",
      url: "https://acme.atlassian.net",
      email: "ana@example.com",
      apiToken: "tok",
    });
  });

  it("sends Jira Data Center only the personal access token", () => {
    expect(
      buildConnection(
        "jira",
        values({ url: "https://jira.example.com", token: "pat" }),
      ),
    ).toEqual({
      source: "jira",
      url: "https://jira.example.com",
      apiToken: "pat",
    });
  });

  it("uses a PLANKA API key or a username and password", () => {
    expect(
      buildConnection(
        "planka",
        values({ url: "https://p.example.com", apiKey: "k" }),
      ),
    ).toEqual({ source: "planka", url: "https://p.example.com", apiKey: "k" });
    expect(
      buildConnection(
        "planka",
        values({
          url: "https://p.example.com",
          plankaSignIn: "password",
          username: "ana",
          password: "pw",
          apiKey: "ignored",
        }),
      ),
    ).toEqual({
      source: "planka",
      url: "https://p.example.com",
      username: "ana",
      password: "pw",
    });
  });

  it("waits for required fields", () => {
    expect(buildConnection("jira", values({ url: "https://x" }))).toBeNull();
    expect(buildConnection("planka", values({ apiKey: "k" }))).toBeNull();
    expect(
      buildConnection(
        "planka",
        values({ url: "https://x", plankaSignIn: "password", username: "a" }),
      ),
    ).toBeNull();
  });
});
