import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SprintReport } from "@/types/sprint";
import { SprintReportBody } from "./sprint-report-content";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("@/lib/format", () => ({
  formatDateMedium: () => "Oct 30, 2026",
}));

const snapshot: NonNullable<SprintReport["snapshot"]> = {
  version: 1,
  completedAt: "2026-10-30T12:00:00.000Z",
  completedBy: "user-1",
  targetSprintId: null,
  tasks: { total: 3, done: 2, carriedOver: 1 },
  points: { total: 8, done: 5, carriedOver: 3 },
  doneTasks: [
    { id: "t1", number: 1, title: "Ship login" },
    { id: "t2", number: 2, title: "Fix header" },
  ],
  carriedOverTasks: [{ id: "t3", number: 3, title: "Write docs" }],
};

function reportWith(
  value: SprintReport["snapshot"],
  completedByName: string | null = "Ada",
): SprintReport {
  return {
    sprintId: "sprint-1",
    state: "completed",
    completedAt: "2026-10-30T12:00:00.000Z",
    completedByName,
    snapshot: value,
  };
}

describe("SprintReportBody", () => {
  afterEach(cleanup);

  it("renders totals and task lists from the stored snapshot", () => {
    render(
      <SprintReportBody
        report={reportWith(snapshot)}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(
      screen.getByText('common:modals.sprintReport.tasks {"count":2}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('common:modals.sprintReport.points {"count":3}'),
    ).toBeInTheDocument();
    expect(screen.getByText("Ship login")).toBeInTheDocument();
    expect(screen.getByText("Write docs")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(
      screen.getByText(/common:modals\.sprintReport\.completedOnBy .*"Ada"/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/common:modals\.sprintReport\.listTruncated/),
    ).not.toBeInTheDocument();
  });

  it("notes when a stored task list was capped", () => {
    render(
      <SprintReportBody
        report={reportWith({
          ...snapshot,
          tasks: { total: 600, done: 599, carriedOver: 1 },
        })}
        isLoading={false}
        isError={false}
      />,
    );

    expect(
      screen.getByText(
        'common:modals.sprintReport.listTruncated {"shown":2,"total":599}',
      ),
    ).toBeInTheDocument();
  });

  it("shows no report for sprints completed without a snapshot", () => {
    render(
      <SprintReportBody
        report={reportWith(null, null)}
        isLoading={false}
        isError={false}
      />,
    );

    expect(
      screen.getByText("common:modals.sprintReport.noReport"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ship login")).not.toBeInTheDocument();
  });
});
