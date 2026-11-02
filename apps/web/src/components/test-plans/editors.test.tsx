import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestCase, TestResult } from "./api";
import CaseEditor from "./case-editor";
import ResultEditor from "./result-editor";

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(cleanup);
const testCase: TestCase = {
  id: "case-1",
  projectId: "p",
  title: "Transfer",
  preconditions: "Signed in",
  state: "ready",
  revision: 3,
  requirementId: null,
  steps: [{ action: "Confirm transfer", expected: "Transfer completed" }],
  createdAt: "2026-11-02T00:00:00.000Z",
};
const result: TestResult = {
  id: "result-1",
  runId: "run-1",
  caseId: "case-1",
  snapshot: {
    caseId: "case-1",
    revision: 3,
    title: "Transfer snapshot",
    preconditions: "Signed in",
    requirementId: null,
    steps: testCase.steps,
  },
  outcome: "not_run",
  steps: [{ outcome: "not_run", actual: "" }],
  actual: "",
  evidence: [],
  bugId: null,
  updatedBy: null,
  version: 1,
  updatedAt: "2026-11-02T00:00:00.000Z",
};

describe("manual test editors", () => {
  it("adds/removes controlled steps without persisting editor-only IDs", () => {
    const save = vi.fn();
    render(
      <CaseEditor
        existing={testCase}
        items={[]}
        pending={false}
        save={save}
        cancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.change(screen.getByLabelText("Step 2 action"), {
      target: { value: "Check balance" },
    });
    fireEvent.change(screen.getByLabelText("Step 2 expected"), {
      target: { value: "Balance updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove step 1" }));
    expect(
      (screen.getByLabelText("Step 1 action") as HTMLTextAreaElement).value,
    ).toBe("Check balance");
    fireEvent.click(screen.getByRole("button", { name: "Save case" }));
    expect(save).toHaveBeenCalledWith({
      title: "Transfer",
      preconditions: "Signed in",
      requirementId: null,
      state: "ready",
      steps: [{ action: "Check balance", expected: "Balance updated" }],
    });
  });
  it("saves result version, step verdicts, actual and evidence independently of the case definition", () => {
    const save = vi.fn();
    const dirty = vi.fn();
    render(
      <ResultEditor
        result={result}
        editable
        pending={false}
        bugs={[]}
        save={save}
        onDirty={dirty}
      />,
    );
    expect(screen.getByText("Transfer snapshot")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Mark all steps Passed" }),
    );
    fireEvent.change(screen.getByLabelText("Overall actual result"), {
      target: { value: "Balance correct" },
    });
    fireEvent.change(screen.getByLabelText("Evidence links"), {
      target: {
        value: "https://example.test/screenshot\n\nhttps://example.test/log",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));
    expect(save).toHaveBeenCalledWith({
      version: 1,
      outcome: "passed",
      steps: [{ outcome: "passed", actual: "" }],
      actual: "Balance correct",
      evidence: ["https://example.test/screenshot", "https://example.test/log"],
      bugId: null,
    });
    expect(dirty).toHaveBeenCalled();
    expect(result.outcome).toBe("not_run");
  });
  it("renders closed runs read-only", () => {
    render(
      <ResultEditor
        result={result}
        editable={false}
        pending={false}
        bugs={[]}
        save={vi.fn()}
        onDirty={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Case outcome").matches(":disabled")).toBe(
      true,
    );
    expect(
      screen.getByLabelText("Step 1 actual result").matches(":disabled"),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Save result" })).toBeNull();
  });
  it("creates one Bug draft from a failure and includes its link on explicit Save", async () => {
    const createBug = vi.fn().mockResolvedValue("bug-1");
    const save = vi.fn();
    const failed: TestResult = {
      ...result,
      outcome: "failed",
      actual: "500 error",
      steps: [{ outcome: "failed", actual: "500 error" }],
    };
    render(
      <ResultEditor
        result={failed}
        editable
        pending={false}
        bugs={[]}
        save={save}
        onDirty={vi.fn()}
        createBug={createBug}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create Bug from failure" }),
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Linked Bug") as HTMLSelectElement).value,
      ).toBe("bug-1"),
    );
    expect(
      screen
        .getByRole("button", { name: "Create Bug from failure" })
        .matches(":disabled"),
    ).toBe(true);
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ bugId: "bug-1", outcome: "failed" }),
    );
    expect(createBug).toHaveBeenCalledTimes(1);
  });
});
