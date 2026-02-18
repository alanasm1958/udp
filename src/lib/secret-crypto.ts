import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "enc:v1";

function getKey(): Buffer | null {
  const source = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.AUTH_SECRET || "";
  if (!source) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing CREDENTIALS_ENCRYPTION_KEY or AUTH_SECRET for secret encryption");
    }
    return null;
  }

  return createHash("sha256").update(source, "utf8").digest();
}

export function encryptSecret(value: string): string {
  const key = getKey();
  if (!key) {
    // Dev fallback for local compatibility when no key is configured.
    return Buffer.from(value, "utf8").toString("base64");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  if (value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    const [, ivB64, tagB64, dataB64] = value.split(":");
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error("Invalid encrypted secret format");
    }

    const key = getKey();
    if (!key) {
      throw new Error("Encryption key not configured");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }

  // Backward compatibility for legacy base64-only values.
  return Buffer.from(value, "base64").toString("utf8");
}
