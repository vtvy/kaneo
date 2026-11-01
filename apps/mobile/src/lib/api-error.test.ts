import { describe, expect, it } from "vitest";
import { messageFromBody } from "./api-error";

describe("messageFromBody", () => {
  it("uses the server message", () => {
    expect(messageFromBody({ message: "Unauthorized" }, 401)).toBe(
      "Unauthorized",
    );
  });

  it("falls back to Vietnamese when the body has no message", () => {
    expect(messageFromBody({}, 403)).toBe(
      "Bạn không có quyền thực hiện việc này.",
    );
    expect(messageFromBody(null, 404)).toBe("Không tìm thấy.");
  });
});
