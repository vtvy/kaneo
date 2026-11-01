import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkItems from ".";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  navigate: vi.fn(),
  can: vi.fn(() => true),
}));
const data = [
  {
    id: "parent",
    type: "backlog_item",
    parentId: null,
    title: "Transfer payments",
    number: 1,
    sprintId: "s1",
    status: "todo",
    position: 0,
  },
  {
    id: "child",
    type: "task",
    parentId: "parent",
    title: "Build transfer API",
    number: 2,
    sprintId: "s1",
    status: "todo",
    position: 1,
  },
  {
    id: "legacy",
    type: "task",
    parentId: null,
    title: "Existing standalone task",
    number: 3,
    sprintId: null,
    status: null,
    position: 2,
  },
];
vi.mock("@kaneo/libs", () => ({
  client: {
    "work-items": {
      ":projectId": {
        $get: async () => ({ ok: true, json: async () => data }),
        $post: mocks.post,
        ":id": { $patch: mocks.patch },
      },
    },
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [
      { id: "todo", slug: "todo", name: "To Do", isFinal: false },
      { id: "done", slug: "done", name: "Done", isFinal: true },
    ],
  }),
}));
vi.mock("@/hooks/queries/sprint/use-get-sprints-by-project", () => ({
  default: () => ({ data: [{ id: "s1", name: "Sprint 1", state: "future" }] }),
}));
vi.mock("@/hooks/use-project-permission", () => ({
  useProjectPermission: () => ({ can: mocks.can }),
}));
vi.mock("@/fetchers/task/update-task-status", () => ({ default: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

function mount(mode: "tree" | "items" | "sprint") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkItems projectId="project" workspaceId="workspace" mode={mode} />
    </QueryClientProvider>,
  );
}
describe("work item views", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.post.mockResolvedValue({ ok: true });
    mocks.patch.mockResolvedValue({ ok: true });
  });
  it("collapses children and retains ancestors of matching tasks", async () => {
    mount("tree");
    await screen.findByText("Build transfer API");
    fireEvent.click(screen.getByLabelText("Collapse Transfer payments"));
    expect(screen.queryByText("Build transfer API")).toBeNull();
    fireEvent.click(screen.getByLabelText("Expand Transfer payments"));
    fireEvent.change(screen.getByLabelText("Search work items"), {
      target: { value: "Build transfer" },
    });
    expect(screen.getByText("Build transfer API")).toBeTruthy();
    expect(screen.getByText("Transfer payments")).toBeTruthy();
    expect(screen.queryByText("Existing standalone task")).toBeNull();
  });
  it("shows all types in Work items and filters without hiding data globally", async () => {
    mount("items");
    await screen.findByText("Transfer payments");
    fireEvent.change(screen.getByLabelText("Work item type"), {
      target: { value: "task" },
    });
    expect(screen.queryByText("Transfer payments")).toBeNull();
    expect(screen.getByText("Build transfer API")).toBeTruthy();
    expect(screen.getByText("Existing standalone task")).toBeTruthy();
  });
  it("creates a Task directly under its Backlog Item", async () => {
    mount("tree");
    fireEvent.click(
      await screen.findByLabelText("Add child to Transfer payments"),
    );
    expect(
      (screen.getByLabelText("New work item type") as HTMLSelectElement).value,
    ).toBe("task");
    fireEvent.change(screen.getByLabelText("Work item title"), {
      target: { value: "Test transfer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith({
        param: { projectId: "project" },
        json: { title: "Test transfer", type: "task", parentId: "parent" },
      }),
    );
  });
  it("groups Sprint tasks under the parent and renders status controls", async () => {
    mount("sprint");
    await screen.findByText("#1 Transfer payments");
    expect(screen.getByText("#2 Build transfer API")).toBeTruthy();
    expect(screen.getByLabelText("Status for Build transfer API")).toBeTruthy();
    expect(screen.queryByText("Existing standalone task")).toBeNull();
  });
  it("keeps the views read-only for a viewer", async () => {
    mocks.can.mockReturnValue(false);
    mount("tree");
    await screen.findByText("Transfer payments");
    expect(screen.queryByText("New Work Item")).toBeNull();
    expect(
      (
        screen.getByLabelText(
          "Parent for Build transfer API",
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
  });
  it("reorders siblings without changing board position", async () => {
    mount("tree");
    fireEvent.click(
      await screen.findByLabelText("Move Transfer payments down"),
    );
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith({
        param: { projectId: "project", id: "parent" },
        json: { move: "down" },
      }),
    );
  });
  it("assigns a dragged branch through the planning pane", async () => {
    mount("tree");
    await screen.findByText("Transfer payments");
    fireEvent.drop(screen.getByRole("button", { name: "Sprint 1 · 2" }), {
      dataTransfer: { getData: () => "parent" },
    });
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith({
        param: { projectId: "project", id: "parent" },
        json: { sprintId: "s1" },
      }),
    );
  });
});
