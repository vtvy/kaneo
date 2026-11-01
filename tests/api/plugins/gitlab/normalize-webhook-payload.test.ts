import { describe, expect, it } from "vitest";
import { normalizeGitlabWebhookPayload } from "../../../../apps/api/src/plugins/gitlab/utils/normalize-webhook-payload";

const project = {
  name: "Display Name With Spaces",
  path: "my-project",
  path_with_namespace: "group/sub/my-project",
  web_url: "https://gitlab.example.com/group/sub/my-project",
};

describe("normalizeGitlabWebhookPayload", () => {
  it("uses the project path slug and nested namespace, not the display name", () => {
    const result = normalizeGitlabWebhookPayload("Issue Hook", {
      object_kind: "issue",
      project,
      object_attributes: {
        id: 10,
        iid: 3,
        title: "Bug",
        action: "open",
        state: "opened",
        url: "https://gitlab.example.com/group/sub/my-project/-/issues/3",
      },
    });

    expect(result.event).toBe("issues");
    const repository = result.payload.repository as {
      name: string;
      owner: { login: string };
    };
    expect(repository.name).toBe("my-project");
    expect(repository.owner.login).toBe("group/sub");
    expect(result.payload.action).toBe("opened");
    expect((result.payload.issue as { number: number }).number).toBe(3);
  });

  it("maps merge request merges to closed pull requests", () => {
    const result = normalizeGitlabWebhookPayload("Merge Request Hook", {
      object_kind: "merge_request",
      project,
      object_attributes: {
        iid: 7,
        title: "Feature",
        action: "merge",
        state: "merged",
        source_branch: "proj-12",
        url: "https://gitlab.example.com/group/sub/my-project/-/merge_requests/7",
      },
    });

    expect(result.event).toBe("pull_request");
    expect(result.payload.action).toBe("closed");
    const pr = result.payload.pull_request as {
      merged: boolean;
      head: { ref: string };
    };
    expect(pr.merged).toBe(true);
    expect(pr.head.ref).toBe("proj-12");
  });

  it("ignores confidential issues and notes", () => {
    expect(
      normalizeGitlabWebhookPayload("Confidential Issue Hook", {
        object_kind: "issue",
        event_type: "confidential_issue",
        project,
        object_attributes: { iid: 1, action: "open", confidential: true },
      }).event,
    ).toBe("ignored");

    expect(
      normalizeGitlabWebhookPayload("Confidential Note Hook", {
        object_kind: "note",
        event_type: "confidential_note",
        project,
        object_attributes: { id: 1, noteable_type: "Issue", note: "secret" },
        issue: { iid: 1, confidential: true },
      }).event,
    ).toBe("ignored");
  });

  it("only maps notes on issues to issue comments", () => {
    const result = normalizeGitlabWebhookPayload("Note Hook", {
      object_kind: "note",
      project,
      object_attributes: { id: 1, noteable_type: "MergeRequest", note: "hi" },
    });
    expect(result.event).toBe("note");
  });
});
