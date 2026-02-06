import { describe, it, expect } from "vitest";
import {
  planAllows,
  getPlanCapabilities,
  hasActiveSubscription,
  getCapabilityFromPath,
} from "./entitlements";

describe("planAllows", () => {
  it("allows reports on free plan", () => {
    expect(planAllows("free", "reports")).toBe(true);
  });

  it("denies sales on free plan", () => {
    expect(planAllows("free", "sales")).toBe(false);
  });

  it("allows all capabilities on pro plan", () => {
    expect(planAllows("pro", "reports")).toBe(true);
    expect(planAllows("pro", "sales")).toBe(true);
    expect(planAllows("pro", "finance")).toBe(true);
    expect(planAllows("pro", "ai")).toBe(true);
    expect(planAllows("pro", "hr")).toBe(true);
    expect(planAllows("pro", "marketing")).toBe(true);
    expect(planAllows("pro", "grc")).toBe(true);
    expect(planAllows("pro", "strategy")).toBe(true);
  });

  it("returns false for unknown plans", () => {
    expect(planAllows("nonexistent", "reports")).toBe(false);
  });
});

describe("getPlanCapabilities", () => {
  it("returns capabilities for known plans", () => {
    const caps = getPlanCapabilities("starter");
    expect(caps).toContain("reports");
    expect(caps).toContain("sales");
    expect(caps).toContain("ai");
  });

  it("returns empty array for unknown plans", () => {
    expect(getPlanCapabilities("nonexistent")).toEqual([]);
  });
});

describe("hasActiveSubscription", () => {
  it("returns false for null subscription", () => {
    expect(hasActiveSubscription(null)).toBe(false);
  });

  it("returns true for active subscription within period", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(
      hasActiveSubscription({
        id: "test",
        tenantId: "t1",
        planCode: "pro",
        status: "active",
        isCurrent: true,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,
        endedAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).toBe(true);
  });

  it("returns false for expired subscription", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(
      hasActiveSubscription({
        id: "test",
        tenantId: "t1",
        planCode: "pro",
        status: "active",
        isCurrent: true,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: pastDate,
        endedAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).toBe(false);
  });

  it("returns false for canceled subscription", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(
      hasActiveSubscription({
        id: "test",
        tenantId: "t1",
        planCode: "pro",
        status: "canceled",
        isCurrent: true,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,
        endedAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).toBe(false);
  });
});

describe("getCapabilityFromPath", () => {
  it("returns null for auth routes", () => {
    expect(getCapabilityFromPath("/api/auth/login")).toBeNull();
    expect(getCapabilityFromPath("/api/auth/me")).toBeNull();
  });

  it("returns null for billing routes", () => {
    expect(getCapabilityFromPath("/api/billing/status")).toBeNull();
  });

  it("maps finance routes correctly", () => {
    expect(getCapabilityFromPath("/api/finance/payments")).toBe("finance");
    expect(getCapabilityFromPath("/api/finance/journal-entries")).toBe("finance");
  });

  it("maps sales routes correctly", () => {
    expect(getCapabilityFromPath("/api/sales/docs")).toBe("sales");
  });

  it("maps procurement routes correctly", () => {
    expect(getCapabilityFromPath("/api/procurement/docs")).toBe("procurement");
  });

  it("maps inventory routes correctly", () => {
    expect(getCapabilityFromPath("/api/omni/inventory/balances")).toBe("inventory");
    expect(getCapabilityFromPath("/api/reports/inventory/balances")).toBe("inventory");
  });

  it("maps HR routes correctly", () => {
    expect(getCapabilityFromPath("/api/hr-people/persons")).toBe("hr");
    expect(getCapabilityFromPath("/api/people/directory")).toBe("hr");
    expect(getCapabilityFromPath("/api/payroll/runs")).toBe("hr");
  });

  it("maps marketing routes correctly", () => {
    expect(getCapabilityFromPath("/api/marketing/campaigns")).toBe("marketing");
  });

  it("maps GRC routes correctly", () => {
    expect(getCapabilityFromPath("/api/grc/requirements")).toBe("grc");
  });

  it("maps strategy routes correctly", () => {
    expect(getCapabilityFromPath("/api/strategy/initiatives")).toBe("strategy");
  });

  it("maps AI routes correctly", () => {
    expect(getCapabilityFromPath("/api/ai/cards")).toBe("ai");
  });

  it("returns null for admin routes", () => {
    expect(getCapabilityFromPath("/api/admin/users")).toBeNull();
  });
});
