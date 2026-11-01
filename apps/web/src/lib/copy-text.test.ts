import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copy-text";

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const originalSecure = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext",
);

function setEnv({
  secure,
  writeText,
}: {
  secure: boolean;
  writeText?: (text: string) => Promise<void>;
}) {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: secure,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function mockExecCommand(result: boolean) {
  const execCommand = vi.fn(() => {
    const active = document.activeElement as HTMLTextAreaElement | null;
    copied = active?.value ?? null;
    return result;
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
  return execCommand;
}

let copied: string | null = null;

afterEach(() => {
  copied = null;
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  if (originalSecure) {
    Object.defineProperty(window, "isSecureContext", originalSecure);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
  Reflect.deleteProperty(document, "execCommand");
});

describe("copyText", () => {
  it("uses the Clipboard API in a secure context", async () => {
    const writeText = vi.fn(async () => {});
    setEnv({ secure: true, writeText });
    const execCommand = mockExecCommand(true);

    await copyText("secret");

    expect(writeText).toHaveBeenCalledWith("secret");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to execCommand on insecure (HTTP LAN) origins", async () => {
    const writeText = vi.fn(async () => {});
    setEnv({ secure: false, writeText });
    const execCommand = mockExecCommand(true);

    await copyText("lan-secret");

    expect(writeText).not.toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("lan-secret");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when the Clipboard API rejects the write", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("denied");
    });
    setEnv({ secure: true, writeText });
    const execCommand = mockExecCommand(true);

    await copyText("denied-secret");

    expect(writeText).toHaveBeenCalledWith("denied-secret");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("denied-secret");
  });

  it("falls back when the Clipboard API is missing", async () => {
    setEnv({ secure: true });
    mockExecCommand(true);

    await copyText("no-api");

    expect(copied).toBe("no-api");
  });

  it("rejects and cleans up when the copy command fails", async () => {
    setEnv({ secure: false });
    mockExecCommand(false);

    await expect(copyText("x")).rejects.toThrow("Copy command was rejected");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
