import { cleanup, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: vi.fn() },
}));

import { authClient } from "@/lib/auth-client";
import AuthProvider, { AuthContext } from ".";

function CurrentUser() {
  const { user } = useContext(AuthContext);
  return <span>{user?.name ?? "Signed out"}</span>;
}

const useSession = vi.mocked(authClient.useSession);

describe("auth state during background session checks", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Victor" } },
      isPending: false,
      error: null,
    } as never);
  });

  it("keeps the current user during a temporary server outage", () => {
    const view = render(
      <AuthProvider>
        <CurrentUser />
      </AuthProvider>,
    );
    useSession.mockReturnValue({
      data: null,
      isPending: false,
      error: { status: 503 },
    } as never);
    view.rerender(
      <AuthProvider>
        <CurrentUser />
      </AuthProvider>,
    );
    expect(screen.getByText("Victor")).toBeInTheDocument();
  });

  it("clears the current user when the server confirms a missing session", () => {
    const view = render(
      <AuthProvider>
        <CurrentUser />
      </AuthProvider>,
    );
    useSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    } as never);
    view.rerender(
      <AuthProvider>
        <CurrentUser />
      </AuthProvider>,
    );
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });

  it("does not keep an expired session reported as 401", () => {
    const view = render(
      <AuthProvider>
        <CurrentUser />
      </AuthProvider>,
    );
    useSession.mockReturnValue({
      data: null,
      isPending: false,
      error: { status: 401 },
    } as never);
    view.rerender(
      <AuthProvider>
        <CurrentUser />
      </AuthProvider>,
    );
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });
});
