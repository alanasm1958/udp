/**
 * Posting Service - Re-export
 *
 * This file re-exports everything from the posting module directory
 * for backward compatibility. All implementation has been moved to
 * src/lib/posting/ (types.ts, core.ts, sales.ts, purchase.ts,
 * payment.ts, inventory.ts, journal.ts).
 *
 * Import from "@/lib/posting" continues to work via the barrel index.
 */
export * from "./posting/index";
