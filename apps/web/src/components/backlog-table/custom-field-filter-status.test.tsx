import en from "@i18n/en-US.json";
import { cleanup, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it, vi } from "vitest";
import { CustomFieldFilterStatus } from "./custom-field-columns";

const i18n = i18next.createInstance();
await i18n.init({
  lng: "en-US",
  resources: { "en-US": en },
  interpolation: { escapeValue: false },
});

afterEach(() => cleanup());

const ready = {
  hasData: true,
  isLoading: false,
  isError: false,
  retry: vi.fn(),
};

it("says results skip custom-field filters while values are still loading", () => {
  render(
    <I18nextProvider i18n={i18n}>
      <CustomFieldFilterStatus
        active
        status={{ ...ready, hasData: false, isLoading: true }}
      />
    </I18nextProvider>,
  );

  expect(screen.getByRole("status").textContent).toContain(
    "without custom-field filters",
  );
});

it("offers a retry when custom-field values failed to load", () => {
  const retry = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <CustomFieldFilterStatus
        active
        status={{ ...ready, hasData: false, isError: true, retry }}
      />
    </I18nextProvider>,
  );

  screen.getByRole("alert").querySelector("button")?.click();
  expect(retry).toHaveBeenCalledOnce();
});
