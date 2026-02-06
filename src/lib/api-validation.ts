/**
 * API request validation using Zod.
 * Provides reusable schemas and a validation helper for API routes.
 */

import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Validate request body against a Zod schema.
 * Returns parsed data on success, or a NextResponse error on failure.
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    return {
      success: false,
      response: NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  params: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });

  return validateBody(schema, obj);
}

// ============================================================================
// Reusable schema fragments
// ============================================================================

export const uuidSchema = z.string().uuid("Must be a valid UUID");

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Must be a valid date in YYYY-MM-DD format"
);

export const positiveAmountSchema = z.string().refine(
  (val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  },
  "Must be a positive number"
);

export const currencySchema = z.string().length(3, "Currency must be a 3-letter ISO code").default("USD");

// ============================================================================
// Finance schemas
// ============================================================================

export const createPaymentSchema = z.object({
  type: z.enum(["receipt", "payment"]),
  method: z.enum(["cash", "bank"]),
  paymentDate: dateSchema,
  partyId: uuidSchema.optional(),
  currency: currencySchema.optional(),
  amount: positiveAmountSchema,
  memo: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
});

export const createJournalEntrySchema = z.object({
  memo: z.string().min(1, "Memo is required").max(500),
  postingDate: dateSchema,
  lines: z.array(z.object({
    accountId: uuidSchema,
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
    description: z.string().max(300).optional(),
  })).min(2, "At least two journal lines required"),
});

// ============================================================================
// Sales schemas
// ============================================================================

export const createSalesDocSchema = z.object({
  type: z.enum(["invoice", "quote", "credit_note", "order"]),
  partyId: uuidSchema,
  docDate: dateSchema,
  dueDate: dateSchema.optional(),
  currency: currencySchema.optional(),
  memo: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
});

// ============================================================================
// Procurement schemas
// ============================================================================

export const createPurchaseDocSchema = z.object({
  type: z.enum(["purchase_order", "bill", "credit_note"]),
  partyId: uuidSchema,
  docDate: dateSchema,
  dueDate: dateSchema.optional(),
  currency: currencySchema.optional(),
  memo: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
});

// ============================================================================
// Master data schemas
// ============================================================================

export const createPartySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["customer", "vendor", "employee", "bank", "government", "other"]),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  type: z.enum(["good", "service"]).default("good"),
  unitPrice: z.coerce.number().min(0).optional(),
  description: z.string().max(500).optional(),
});
