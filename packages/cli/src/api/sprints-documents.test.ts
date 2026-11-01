import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { DocumentSummary, FolderSummary } from "./documents.js";
import { BacklogTask, SprintSummary } from "./sprints.js";

describe("sprint and document payloads", () => {
  it("keeps the fields the commands print and ignores the rest", () => {
    const sprint = Schema.decodeUnknownSync(SprintSummary)({
      id: "sprint-1",
      projectId: "project-1",
      name: "Sprint 1",
      state: "active",
      startDate: null,
      endDate: "2026-11-08T00:00:00.000Z",
      goal: "Ship the board",
      createdAt: "2026-11-01T00:00:00.000Z",
    });
    const task = Schema.decodeUnknownSync(BacklogTask)({
      id: "task-1",
      title: "No status",
      number: null,
      status: null,
      priority: "medium",
      userId: "user-1",
    });
    const folder = Schema.decodeUnknownSync(FolderSummary)({
      id: "folder-1",
      projectId: "project-1",
      name: "Notes",
      parentId: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    });
    const document = Schema.decodeUnknownSync(DocumentSummary)({
      id: "doc-1",
      projectId: "project-1",
      name: "spec.md",
      source: "server",
      folderId: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    });

    expect(sprint.name).toBe("Sprint 1");
    expect(task.status).toBeNull();
    expect(folder.name).toBe("Notes");
    expect(document.source).toBe("server");
  });
});
