import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, activeWorkspace } = vi.hoisted(() => ({
  navigate: vi.fn(),
  activeWorkspace: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: "/dashboard/settings/account/information" }),
  Outlet: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: activeWorkspace,
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/admin/use-instance-access", () => ({
  default: () => ({ data: { isAdmin: false, permissions: [] } }),
}));

import WorkspaceCrumbSelect from "@/components/common/header/workspace-crumb-select";
import { Route } from "@/routes/_layout/_authenticated/dashboard/settings";
import { Route as MissingWorkspaceRoute } from "@/routes/_layout/_authenticated/dashboard/workspace/index";

const SettingsLayout = Route.options.component as ComponentType;

describe("workspace navigation while workspace data is pending", () => {
  afterEach(cleanup);

  beforeEach(() => {
    navigate.mockReset();
    activeWorkspace.mockReturnValue({ data: undefined });
  });

  it("returns from settings to home without building an empty workspace URL", () => {
    render(<SettingsLayout />);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:page.backToWorkspace" }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("opens home from the workspace breadcrumb before an active workspace loads", () => {
    render(<WorkspaceCrumbSelect />);
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("preserves workspace navigation when the ID is available", () => {
    activeWorkspace.mockReturnValue({
      data: { id: "workspace-1", name: "Team" },
    });
    render(<WorkspaceCrumbSelect />);
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: "workspace-1" },
    });
  });

  it("recovers old workspace links without an ID through the dashboard", async () => {
    await expect(
      Promise.resolve().then(() =>
        MissingWorkspaceRoute.options.beforeLoad?.({} as never),
      ),
    ).rejects.toMatchObject({
      options: { to: "/dashboard", replace: true },
    });
  });
});
