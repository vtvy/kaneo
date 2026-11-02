import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestPlans from ".";

const mocks = vi.hoisted(() => ({
  readOnly: false,
  overview: vi.fn(),
  start: vi.fn(),
  detail: vi.fn(),
  saveResult: vi.fn(),
  transition: vi.fn(),
  saveCase: vi.fn(),
  savePlan: vi.fn(),
  saveSuite: vi.fn(),
  membership: vi.fn(),
}));
vi.mock("./api", () => ({ testPlanApi: mocks }));
vi.mock("@kaneo/libs", () => ({
  client: {
    "work-items": {
      ":projectId": { $get: async () => ({ ok: true, json: async () => [] }) },
    },
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="#work-items">{children}</a>
  ),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "tester" } }),
}));
vi.mock("@/hooks/use-project-permission", () => ({
  useProjectPermission: () => ({
    can: (_resource: string, action: string) =>
      action === "read" || !mocks.readOnly,
    isCheckingPermissions: false,
  }),
}));
vi.mock("@/hooks/queries/sprint/use-get-sprints-by-project", () => ({
  default: () => ({ data: [] }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({ useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }) }),
);
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const plan = {
  id: "plan",
  title: "Release 1",
  projectId: "p",
  state: "active",
  description: "Smoke test",
  release: "1",
  sprintId: null,
  createdAt: "2026-11-02",
};
const testCase = {
  id: "case",
  projectId: "p",
  title: "Login",
  state: "ready",
  revision: 1,
  preconditions: "",
  requirementId: null,
  steps: [{ action: "Sign in", expected: "Dashboard" }],
  createdAt: "2026-11-02",
};
const run = {
  id: "run",
  planId: "plan",
  title: "Smoke run",
  suiteId: "suite",
  testerId: "tester",
  state: "in_progress",
  version: 1,
  environment: "staging",
  build: "abc",
  createdAt: "2026-11-02",
};
const result = {
  id: "result",
  runId: "run",
  caseId: "case",
  version: 1,
  snapshot: {
    caseId: "case",
    revision: 1,
    title: "Login snapshot",
    preconditions: "",
    requirementId: null,
    steps: testCase.steps,
  },
  outcome: "not_run",
  steps: [{ outcome: "not_run", actual: "" }],
  actual: "",
  evidence: [],
  bugId: null,
};
function mount() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TestPlans projectId="p" workspaceId="w" />
    </QueryClientProvider>,
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.readOnly = false;
  mocks.overview.mockResolvedValue({
    plans: [plan],
    suites: [{ id: "suite", planId: "plan", title: "Smoke" }],
    cases: [testCase],
    links: [{ suiteId: "suite", caseId: "case" }],
    runs: [run],
  });
  mocks.start.mockResolvedValue(run);
  mocks.detail.mockResolvedValue({
    run,
    results: [result],
    summary: {
      total: 1,
      not_run: 1,
      passed: 0,
      failed: 0,
      blocked: 0,
      not_applicable: 0,
      executed: 0,
      passRate: null,
    },
  });
  mocks.saveResult.mockResolvedValue({ ...result, version: 2 });
});
describe("Test Plans project page", () => {
  it("shows plan cases, case library and suite controls", async () => {
    mount();
    await screen.findByText("Login");
    expect(screen.getByRole("button", { name: "New case" })).toBeTruthy();
    expect(screen.getByLabelText("Test suite")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New case" }));
    expect(screen.getByLabelText("Case title")).toBeTruthy();
  });
  it("starts a manual run and protects unsaved results before completion", async () => {
    mount();
    await screen.findByText("Login");
    fireEvent.click(screen.getByRole("button", { name: /^Execute$/ }));
    fireEvent.change(screen.getByLabelText("Run environment"), {
      target: { value: "staging" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start manual run" }));
    await screen.findByText("Login snapshot");
    expect(mocks.start).toHaveBeenCalledWith(
      "p",
      "plan",
      expect.objectContaining({
        testerId: "tester",
        environment: "staging",
        clientKey: expect.any(String),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mark all steps Passed" }),
    );
    expect(
      screen.getByRole("button", { name: "Complete run" }).matches(":disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));
    await waitFor(() =>
      expect(mocks.saveResult).toHaveBeenCalledWith(
        "p",
        "run",
        "result",
        expect.objectContaining({ version: 1, outcome: "passed" }),
      ),
    );
  });
  it("keeps read-only users out of authoring and execution controls", async () => {
    mocks.readOnly = true;
    mount();
    await screen.findByText("Login");
    expect(screen.queryByRole("button", { name: "New plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "New case" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Execute" }));
    expect(
      screen.queryByRole("button", { name: "Start manual run" }),
    ).toBeNull();
  });
});
