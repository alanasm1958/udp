/**
 * AI Actions - Signed confirm action tokens for mutations
 *
 * When the AI wants to perform a mutation (create, update, delete),
 * it must first create a signed action token that the user confirms.
 * This ensures no accidental or unauthorized mutations occur.
 */

import { createHmac, randomBytes } from "crypto";

/**
 * Action types that require confirmation
 */
export type AIActionType =
  | "draft.salesDocument"
  | "draft.purchaseDocument"
  | "draft.payment"
  | "draft.journalEntry"
  | "post.document"
  | "navigate";

/**
 * Action payload structure
 */
export interface AIAction {
  type: AIActionType;
  label: string;
  description: string;
  payload: Record<string, unknown>;
}

/**
 * Signed action token
 */
export interface SignedAction {
  token: string;
  action: AIAction;
  expiresAt: number; // Unix timestamp
  tenantId: string;
  userId: string;
}

/**
 * Get the signing secret (from env or generate stable one for dev)
 */
function getSigningSecret(): string {
  const secret = process.env.AI_ACTION_SECRET;
  if (secret) return secret;

  // For development, use a stable default
  if (process.env.NODE_ENV === "development") {
    return "dev-ai-action-secret-do-not-use-in-prod";
  }

  throw new Error("AI_ACTION_SECRET environment variable is required in production");
}

/**
 * Create a signed action token
 */
export function createActionToken(
  action: AIAction,
  tenantId: string,
  userId: string,
  ttlSeconds: number = 300 // 5 minute default
): SignedAction {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomBytes(16).toString("hex");

  const dataToSign = JSON.stringify({
    action,
    tenantId,
    userId,
    expiresAt,
    nonce,
  });

  const hmac = createHmac("sha256", getSigningSecret());
  hmac.update(dataToSign);
  const signature = hmac.digest("hex");

  // Token format: base64(json + signature)
  const tokenData = {
    action,
    tenantId,
    userId,
    expiresAt,
    nonce,
    sig: signature,
  };

  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64url");

  return {
    token,
    action,
    expiresAt,
    tenantId,
    userId,
  };
}

/**
 * Verify and decode an action token
 */
export function verifyActionToken(
  token: string,
  expectedTenantId: string,
  expectedUserId: string
): { valid: true; action: AIAction } | { valid: false; error: string } {
  try {
    const jsonStr = Buffer.from(token, "base64url").toString("utf-8");
    const tokenData = JSON.parse(jsonStr);

    const { action, tenantId, userId, expiresAt, nonce, sig } = tokenData;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt < now) {
      return { valid: false, error: "Action token has expired" };
    }

    // Check tenant/user match
    if (tenantId !== expectedTenantId) {
      return { valid: false, error: "Token tenant mismatch" };
    }
    if (userId !== expectedUserId) {
      return { valid: false, error: "Token user mismatch" };
    }

    // Verify signature
    const dataToSign = JSON.stringify({
      action,
      tenantId,
      userId,
      expiresAt,
      nonce,
    });

    const hmac = createHmac("sha256", getSigningSecret());
    hmac.update(dataToSign);
    const expectedSig = hmac.digest("hex");

    if (sig !== expectedSig) {
      return { valid: false, error: "Invalid token signature" };
    }

    return { valid: true, action };
  } catch {
    return { valid: false, error: "Invalid token format" };
  }
}

/**
 * Action definitions for the AI to use
 */
export const ACTION_DEFINITIONS = {
  "draft.salesDocument": {
    label: "Create Draft Sales Document",
    description: "Creates a new sales document (quote, order, or invoice) in draft status",
    requiredFields: ["docType", "customerId"],
    optionalFields: ["lines", "notes"],
  },
  "draft.purchaseDocument": {
    label: "Create Draft Purchase Document",
    description: "Creates a new purchase document (RFQ or order) in draft status",
    requiredFields: ["docType", "vendorId"],
    optionalFields: ["lines", "notes"],
  },
  "draft.payment": {
    label: "Create Draft Payment",
    description: "Creates a new payment in draft status",
    requiredFields: ["partyId", "paymentType", "amount"],
    optionalFields: ["reference", "allocations"],
  },
  "draft.journalEntry": {
    label: "Create Draft Journal Entry",
    description: "Creates a manual journal entry in draft status",
    requiredFields: ["lines"],
    optionalFields: ["memo", "reference"],
  },
  "post.document": {
    label: "Post Document",
    description: "Posts a document, making it permanent",
    requiredFields: ["documentId", "documentType"],
    optionalFields: [],
  },
  "navigate": {
    label: "Navigate to Page",
    description: "Navigate to a specific page in the application",
    requiredFields: ["route"],
    optionalFields: [],
  },
} as const;

/**
 * Format an action for display to the user
 */
export function formatActionForDisplay(action: AIAction): string {
  const def = ACTION_DEFINITIONS[action.type];
  return `**${def.label}**\n${action.description}\n\n${JSON.stringify(action.payload, null, 2)}`;
}

/**
 * Pending actions storage (in-memory for now, could be Redis in production)
 */
const pendingActions = new Map<string, SignedAction>();

/**
 * Store a pending action for confirmation
 */
export function storePendingAction(signedAction: SignedAction): void {
  pendingActions.set(signedAction.token, signedAction);

  // Clean up expired actions periodically
  setTimeout(() => {
    pendingActions.delete(signedAction.token);
  }, (signedAction.expiresAt - Math.floor(Date.now() / 1000)) * 1000 + 1000);
}

/**
 * Get and remove a pending action
 */
export function consumePendingAction(token: string): SignedAction | null {
  const action = pendingActions.get(token);
  if (action) {
    pendingActions.delete(token);
    return action;
  }
  return null;
}
