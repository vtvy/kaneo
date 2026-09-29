import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActiveFilterChip from "./active-filter-chip";

describe("ActiveFilterChip", () => {
  it("shows filter details and clears the filter", () => {
    const onClear = vi.fn();

    render(
      <ActiveFilterChip
        subject="Status"
        operator="is any of"
        value="2 selected"
        onClear={onClear}
      />,
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("is any of")).toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
