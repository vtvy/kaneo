import en from "@i18n/en-US.json";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BacklogTable from ".";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/queries/task/use-all-project-tasks", () => ({
  useAllProjectTasks: () => ({
    data: [
      {
        id: "task",
        title: "Task",
        number: 1,
        status: "Todo",
        priority: null,
        points: null,
        sprintId: null,
        sprintName: null,
        columnId: null,
        columnName: null,
        columnColor: null,
        assigneeId: null,
        assigneeName: null,
        reporterId: null,
        reporterName: null,
        reporterImage: null,
        dueDate: null,
        createdAt: null,
        position: 0,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({
    default: () => ({ data: [] }),
  }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-values-by-project",
  () => ({ default: () => ({ data: [], isSuccess: true }) }),
);
vi.mock("@/components/sprint/task-sprint-popover", () => ({
  default: () => null,
}));
vi.mock("@/components/task/task-assignee-popover", () => ({
  default: () => null,
}));
vi.mock("@/components/task/task-priority-popover", () => ({
  default: () => null,
}));
vi.mock("@/components/task/task-status-popover", () => ({
  default: () => null,
}));

const i18n = i18next.createInstance();
await i18n.init({
  lng: "en-US",
  resources: { "en-US": en },
  interpolation: { escapeValue: false },
});

// Vitest globals are disabled, so testing-library cannot auto-cleanup.
afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(
    "kaneo:backlog-saved-views:a",
    JSON.stringify([
      {
        id: "view",
        name: "QC bugs",
        filters: { status: ["Todo"] },
        titleQuery: "",
        sort: null,
        isDefault: true,
        createdAt: "2026-10-14",
      },
    ]),
  );
});

it("renames a saved view through the menu and restores its name after remount", async () => {
  const first = render(
    <I18nextProvider i18n={i18n}>
      <BacklogTable projectId="a" workspaceId="w" />
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Saved views/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Rename view" }));
  const input = screen.getByRole("textbox", { name: "View name" });
  fireEvent.change(input, { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Save view name" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "  Regression bugs  " } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(
      JSON.parse(
        window.localStorage.getItem("kaneo:backlog-saved-views:a") ?? "[]",
      )[0],
    ).toMatchObject({
      id: "view",
      name: "Regression bugs",
      isDefault: true,
      filters: { status: ["Todo"] },
    }),
  );
  first.unmount();
  render(
    <I18nextProvider i18n={i18n}>
      <BacklogTable projectId="a" workspaceId="w" />
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Saved views/i }));
  expect(
    await screen.findByRole("button", { name: "Regression bugs" }),
  ).toBeInTheDocument();
});

it("Clear all filters is available for sort-only state and resets storage", async () => {
  window.localStorage.setItem("kaneo:backlog-saved-views:a", "[]");
  window.localStorage.setItem(
    "kaneo:backlog-filters:a",
    JSON.stringify({
      filters: {},
      titleQuery: "",
      sort: { column: "title", direction: "asc" },
    }),
  );
  render(
    <I18nextProvider i18n={i18n}>
      <BacklogTable projectId="a" workspaceId="w" />
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Clear all filters" }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(
        window.localStorage.getItem("kaneo:backlog-filters:a") ?? "null",
      ),
    ).toEqual({
      filters: {},
      createdAtFilters: [],
      customFieldFilters: {},
      titleQuery: "",
      sort: null,
      customFieldColumns: [],
    }),
  );
});

it.each([
  "button",
  "Escape",
  "menu-close",
])("discards an unfinished rename through %s", async (action) => {
  render(
    <I18nextProvider i18n={i18n}>
      <BacklogTable projectId="a" workspaceId="w" />
    </I18nextProvider>,
  );
  const menu = screen.getByRole("button", { name: /Saved views/i });
  fireEvent.click(menu);
  fireEvent.click(await screen.findByRole("button", { name: "Rename view" }));
  const input = screen.getByRole("textbox", { name: "View name" });
  fireEvent.change(input, { target: { value: "Unfinished rename" } });
  if (action === "button") {
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  } else if (action === "Escape") {
    fireEvent.keyDown(input, { key: "Escape" });
  } else {
    fireEvent.click(menu);
    await waitFor(() => expect(input).not.toBeInTheDocument());
    fireEvent.click(menu);
  }
  expect(
    await screen.findByRole("button", { name: "QC bugs" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "View name" }),
  ).not.toBeInTheDocument();
  expect(
    JSON.parse(
      window.localStorage.getItem("kaneo:backlog-saved-views:a") ?? "[]",
    )[0].name,
  ).toBe("QC bugs");
});
