import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

// AES-256-GCM encryption for secrets stored at rest (e.g. OAuth refresh tokens).
// The key is derived from DRIVE_TOKEN_ENC_KEY, falling back to AUTH_SECRET.
function getKey(): Buffer {
  const secret = (
    process.env.DRIVE_TOKEN_ENC_KEY ||
    process.env.AUTH_SECRET ||
    ""
  ).trim();
  if (!secret) {
    throw new Error(
      "Cannot encrypt secrets: set DRIVE_TOKEN_ENC_KEY or AUTH_SECRET.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

// Format: v1:<iv b64>:<authTag b64>:<ciphertext b64>
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unsupported or malformed secret payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
