import { beforeEach, describe, expect, it, vi } from "vitest";

const publicFetch = vi.fn();
const assertPublicDestination = vi.fn(async () => {});

vi.mock("../../../../apps/api/src/utils/public-fetch", () => ({
  publicFetch: (...args: unknown[]) => publicFetch(...args),
}));

vi.mock("../../../../apps/api/src/utils/assert-public-destination", () => ({
  assertPublicDestination: (...args: unknown[]) =>
    assertPublicDestination(...(args as [])),
}));

const { GitlabApiError, gitlabFetch, createGitlabClient } = await import(
  "../../../../apps/api/src/plugins/gitlab/utils/gitlab-api"
);

describe("gitlabFetch", () => {
  beforeEach(() => {
    publicFetch.mockReset();
    assertPublicDestination.mockReset();
    assertPublicDestination.mockImplementation(async () => {});
  });

  it("goes through publicFetch with the PRIVATE-TOKEN header", async () => {
    publicFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 1, username: "me" }), { status: 200 }),
    );

    await gitlabFetch("https://gitlab.example/", "tok", "/user");

    expect(assertPublicDestination).toHaveBeenCalledWith(
      "https://gitlab.example",
      "GitLab",
    );
    const [url, init] = publicFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://gitlab.example/api/v4/user");
    expect((init.headers as Record<string, string>)["PRIVATE-TOKEN"]).toBe(
      "tok",
    );
  });

  it("keeps the message generic and caps the upstream body", async () => {
    const upstreamBody = `<html>${"secret internal detail ".repeat(100)}</html>`;
    publicFetch.mockResolvedValue(new Response(upstreamBody, { status: 502 }));

    const error = await gitlabFetch(
      "https://gitlab.example",
      "token",
      "/user",
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitlabApiError);
    const gitlabError = error as InstanceType<typeof GitlabApiError>;
    expect(gitlabError.status).toBe(502);
    expect(gitlabError.message).toBe("GitLab API error 502");
    expect(gitlabError.message).not.toContain("secret");
    expect(gitlabError.body?.length).toBeLessThanOrEqual(201);
  });

  it("refuses redirects", async () => {
    publicFetch.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/" },
      }),
    );

    const error = await gitlabFetch(
      "https://gitlab.example",
      "token",
      "/user",
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitlabApiError);
    expect((error as Error).message).toContain("redirected");
    expect(publicFetch).toHaveBeenCalledTimes(1);
  });

  it("turns a blocked destination into a short client error", async () => {
    assertPublicDestination.mockRejectedValue(
      new Error("GitLab destination resolves to a non-routable address"),
    );

    const error = await gitlabFetch(
      "https://internal.example",
      "token",
      "/user",
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitlabApiError);
    expect((error as InstanceType<typeof GitlabApiError>).status).toBe(400);
    expect(publicFetch).not.toHaveBeenCalled();
  });

  it("hides connection error details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    publicFetch.mockRejectedValue(new Error("connect ECONNREFUSED 10.1.2.3"));

    const error = await gitlabFetch(
      "https://gitlab.example",
      "token",
      "/user",
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitlabApiError);
    expect((error as Error).message).not.toContain("10.1.2.3");
    spy.mockRestore();
  });

  it("encodes nested group project paths as a single id", async () => {
    publicFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "proj",
          path_with_namespace: "a/b/proj",
          web_url: "https://gitlab.example/a/b/proj",
          visibility: "private",
        }),
        { status: 200 },
      ),
    );

    const client = createGitlabClient({
      baseUrl: "https://gitlab.example",
      accessToken: "tok",
    });
    await client.getRepo("a/b", "proj");

    expect(publicFetch.mock.calls[0]?.[0]).toBe(
      "https://gitlab.example/api/v4/projects/a%2Fb%2Fproj",
    );
  });
});
