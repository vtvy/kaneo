import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFileMeta: vi.fn(),
  getAccessToken: vi.fn(),
  deleteFile: vi.fn(),
  getDriveIntegrationRow: vi.fn(),
  getDriveIntegration: vi.fn(),
  storageDelete: vi.fn(),
}));
vi.mock("../../../apps/api/src/document/drive/client", () => ({
  DRIVE_FOLDER_MIME: "application/vnd.google-apps.folder",
  assertDriveId: (id: string) => {
    if (!/^[a-zA-Z0-9_-]{1,256}$/.test(id)) throw new Error("Invalid ID");
    return id;
  },
  getFileMeta: mocks.getFileMeta,
  getAccessToken: mocks.getAccessToken,
  deleteFile: mocks.deleteFile,
}));
vi.mock("../../../apps/api/src/document/drive/config", () => ({
  getDriveIntegrationRow: mocks.getDriveIntegrationRow,
  getDriveIntegration: mocks.getDriveIntegration,
  getClientCreds: () => ({ clientId: "client", clientSecret: "secret" }),
  getRefreshToken: () => "refresh",
}));
vi.mock("../../../apps/api/src/storage", () => ({
  storage: { delete: mocks.storageDelete },
}));

import {
  assertFileWithinRoot,
  prepareDocumentBlobDeletion,
  safeDriveUrl,
} from "../../../apps/api/src/document/providers";
import {
  decryptSecret,
  encryptSecret,
} from "../../../apps/api/src/utils/secret-box";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-secret-with-at-least-32-characters");
});

describe("Drive project boundary", () => {
  it("allows nested descendants and rejects another account folder", async () => {
    const files: Record<string, { id: string; parents?: string[] }> = {
      file: { id: "file", parents: ["nested"] },
      nested: { id: "nested", parents: ["root"] },
      root: { id: "root" },
      outside: { id: "outside", parents: ["unrelated"] },
      unrelated: { id: "unrelated" },
    };
    mocks.getFileMeta.mockImplementation(async (_token, id) => files[id]);
    await expect(
      assertFileWithinRoot("token", "file", "root"),
    ).resolves.toEqual(files.file);
    await expect(
      assertFileWithinRoot("token", "outside", "root"),
    ).rejects.toThrow("outside");
  });

  it("rejects malformed IDs before making a request", async () => {
    await expect(
      assertFileWithinRoot("token", "x?alt=media", "root"),
    ).rejects.toThrow("Invalid");
    expect(mocks.getFileMeta).not.toHaveBeenCalled();
  });

  it("terminates cycles rather than walking indefinitely", async () => {
    mocks.getFileMeta.mockResolvedValue({ id: "cycle", parents: ["cycle"] });
    await expect(
      assertFileWithinRoot("token", "cycle", "root"),
    ).rejects.toThrow("outside");
    expect(mocks.getFileMeta).toHaveBeenCalledTimes(2);
  });

  it("keeps only Google HTTPS document links", () => {
    expect(
      safeDriveUrl("https://docs.google.com/document/d/file/edit"),
    ).toContain("docs.google.com");
    for (const raw of [
      "javascript:alert(1)",
      "http://drive.google.com/file",
      "https://docs.google.com.evil.test/file",
      "https://name:secret@docs.google.com/file",
    ])
      expect(safeDriveUrl(raw)).toBeNull();
  });
});

describe("Drive deletion", () => {
  const doc = {
    source: "google_drive",
    storageKey: null,
    externalId: "file",
    projectId: "project",
    driveManaged: true,
  };

  it("captures credentials before database cascades, and deletes only after commit", async () => {
    mocks.getDriveIntegrationRow.mockResolvedValueOnce({
      config: { refreshToken: "encrypted" },
    });
    mocks.getAccessToken.mockResolvedValue("access");
    const remove = await prepareDocumentBlobDeletion(doc);
    expect(mocks.getAccessToken).not.toHaveBeenCalled();
    mocks.getDriveIntegrationRow.mockResolvedValue(null);
    await remove();
    expect(mocks.getAccessToken).toHaveBeenCalledWith(
      { clientId: "client", clientSecret: "secret" },
      "refresh",
    );
    expect(mocks.deleteFile).toHaveBeenCalledWith("access", "file");
    expect(mocks.getDriveIntegrationRow).toHaveBeenCalledTimes(1);
  });

  it("never deletes a linked original", async () => {
    await (
      await prepareDocumentBlobDeletion({ ...doc, driveManaged: false })
    )();
    expect(mocks.getDriveIntegrationRow).not.toHaveBeenCalled();
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });
});

describe("encrypted Drive secrets", () => {
  it("uses independent IVs and authenticates ciphertext", () => {
    const first = encryptSecret("refresh-token");
    expect(first).not.toContain("refresh-token");
    expect(encryptSecret("refresh-token")).not.toBe(first);
    expect(decryptSecret(first)).toBe("refresh-token");
    const parts = first.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});
