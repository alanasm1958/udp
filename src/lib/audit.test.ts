import { describe, it, expect } from "vitest";
import { isValidAuditAction, auditAction } from "./audit";

describe("isValidAuditAction", () => {
  it("accepts valid entity_verb patterns", () => {
    expect(isValidAuditAction("payment_created")).toBe(true);
    expect(isValidAuditAction("journal_entry_posted")).toBe(true);
    expect(isValidAuditAction("user_deactivated")).toBe(true);
    expect(isValidAuditAction("sales_doc_voided")).toBe(true);
    expect(isValidAuditAction("leave_request_approved")).toBe(true);
    expect(isValidAuditAction("role_permissions_updated")).toBe(true);
  });

  it("rejects actions without valid verbs", () => {
    expect(isValidAuditAction("payment_unknown")).toBe(false);
    expect(isValidAuditAction("something_bad")).toBe(false);
  });

  it("rejects single-word actions", () => {
    expect(isValidAuditAction("created")).toBe(false);
    expect(isValidAuditAction("posted")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isValidAuditAction("")).toBe(false);
  });
});

describe("auditAction", () => {
  it("returns the action string for valid actions", () => {
    const result = auditAction("payment_created");
    expect(result).toBe("payment_created");
  });

  it("throws for invalid actions", () => {
    expect(() => auditAction("bad_action_unknown")).toThrow("Invalid audit action");
  });

  it("includes the invalid verb in error message", () => {
    expect(() => auditAction("something_wrong")).toThrow('verb "wrong"');
  });
});
