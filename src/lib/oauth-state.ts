import crypto from "crypto";

export interface OAuthStatePayload {
  tenantId: string;
  userId: string;
  channelId: string;
  provider: string;
  timestamp: number;
  nonce: string;
}

function getOAuthStateSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing AUTH_SECRET/CREDENTIALS_ENCRYPTION_KEY for OAuth state signing");
    }
    return "dev-oauth-state-secret";
  }
  return secret;
}

function sign(data: string): string {
  return crypto
    .createHmac("sha256", getOAuthStateSecret())
    .update(data)
    .digest("base64url");
}

export function createSignedOAuthState(payload: OAuthStatePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySignedOAuthState(state: string): OAuthStatePayload | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as OAuthStatePayload;

    if (
      !decoded ||
      !decoded.tenantId ||
      !decoded.userId ||
      !decoded.channelId ||
      !decoded.provider ||
      typeof decoded.timestamp !== "number" ||
      !decoded.nonce
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
