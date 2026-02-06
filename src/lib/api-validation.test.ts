import { describe, it, expect } from "vitest";
import {
  validateBody,
  uuidSchema,
  dateSchema,
  positiveAmountSchema,
  currencySchema,
  createPaymentSchema,
  createPartySchema,
  createItemSchema,
} from "./api-validation";

describe("uuidSchema", () => {
  it("accepts valid UUIDs", () => {
    const result = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    const result = uuidSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

describe("dateSchema", () => {
  it("accepts YYYY-MM-DD format", () => {
    const result = dateSchema.safeParse("2025-01-15");
    expect(result.success).toBe(true);
  });

  it("rejects other formats", () => {
    expect(dateSchema.safeParse("01/15/2025").success).toBe(false);
    expect(dateSchema.safeParse("2025-1-5").success).toBe(false);
    expect(dateSchema.safeParse("").success).toBe(false);
  });
});

describe("positiveAmountSchema", () => {
  it("accepts positive numbers as strings", () => {
    expect(positiveAmountSchema.safeParse("100.50").success).toBe(true);
    expect(positiveAmountSchema.safeParse("0.01").success).toBe(true);
  });

  it("rejects zero and negative values", () => {
    expect(positiveAmountSchema.safeParse("0").success).toBe(false);
    expect(positiveAmountSchema.safeParse("-10").success).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(positiveAmountSchema.safeParse("abc").success).toBe(false);
  });
});

describe("currencySchema", () => {
  it("accepts 3-letter codes", () => {
    expect(currencySchema.safeParse("USD").success).toBe(true);
    expect(currencySchema.safeParse("EUR").success).toBe(true);
  });

  it("rejects invalid lengths", () => {
    expect(currencySchema.safeParse("US").success).toBe(false);
    expect(currencySchema.safeParse("USDD").success).toBe(false);
  });
});

describe("createPaymentSchema", () => {
  const validPayment = {
    type: "receipt",
    method: "bank",
    paymentDate: "2025-03-15",
    amount: "1500.00",
  };

  it("accepts valid payment data", () => {
    const result = createPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = createPaymentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, type: "refund" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid payment date", () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, paymentDate: "bad-date" });
    expect(result.success).toBe(false);
  });
});

describe("createPartySchema", () => {
  it("accepts valid party", () => {
    const result = createPartySchema.safeParse({
      name: "Acme Corp",
      type: "customer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createPartySchema.safeParse({
      name: "",
      type: "customer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = createPartySchema.safeParse({
      name: "Test",
      type: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

describe("createItemSchema", () => {
  it("accepts valid item with defaults", () => {
    const result = createItemSchema.safeParse({ name: "Widget" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("good");
    }
  });

  it("accepts service type", () => {
    const result = createItemSchema.safeParse({ name: "Consulting", type: "service" });
    expect(result.success).toBe(true);
  });
});

describe("validateBody", () => {
  it("returns parsed data on valid input", () => {
    const result = validateBody(createPartySchema, {
      name: "Test Corp",
      type: "vendor",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Corp");
    }
  });

  it("returns error response on invalid input", () => {
    const result = validateBody(createPartySchema, { name: "" });
    expect(result.success).toBe(false);
  });
});
