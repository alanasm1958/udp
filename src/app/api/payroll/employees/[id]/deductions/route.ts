/**
 * /api/payroll/employees/[id]/deductions
 *
 * Manage employee deduction enrollments (benefits, retirement, garnishments, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { employees, employeeDeductions, deductionTypes, people } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/payroll/employees/[id]/deductions
 * Get all deductions for an employee
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: employeeId } = await params;
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    if (!isValidUuid(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Verify employee exists
    const [employee] = await db
      .select({ id: employees.id, employeeNumber: employees.employeeNumber })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Get deductions with type info
    const conditions = [
      eq(employeeDeductions.tenantId, tenantId),
      eq(employeeDeductions.employeeId, employeeId),
    ];

    if (!includeInactive) {
      conditions.push(eq(employeeDeductions.isActive, true));
    }

    const deductions = await db
      .select({
        id: employeeDeductions.id,
        effectiveFrom: employeeDeductions.effectiveFrom,
        effectiveTo: employeeDeductions.effectiveTo,
        calcMethod: employeeDeductions.calcMethod,
        amount: employeeDeductions.amount,
        perPeriodLimit: employeeDeductions.perPeriodLimit,
        annualLimit: employeeDeductions.annualLimit,
        ytdAmount: employeeDeductions.ytdAmount,
        caseNumber: employeeDeductions.caseNumber,
        garnishmentType: employeeDeductions.garnishmentType,
        garnishmentPriority: employeeDeductions.garnishmentPriority,
        isActive: employeeDeductions.isActive,
        createdAt: employeeDeductions.createdAt,
        // Deduction type info
        deductionTypeId: employeeDeductions.deductionTypeId,
        deductionTypeCode: deductionTypes.code,
        deductionTypeName: deductionTypes.name,
        deductionCategory: deductionTypes.category,
        isPretaxFederal: deductionTypes.isPretaxFederal,
        isPretaxState: deductionTypes.isPretaxState,
        isPretaxFica: deductionTypes.isPretaxFica,
      })
      .from(employeeDeductions)
      .innerJoin(deductionTypes, eq(employeeDeductions.deductionTypeId, deductionTypes.id))
      .where(and(...conditions));

    // Separate active vs inactive
    const active = deductions.filter((d) => d.isActive);
    const inactive = deductions.filter((d) => !d.isActive);

    return NextResponse.json({
      employeeId,
      employeeNumber: employee.employeeNumber,
      activeDeductions: active,
      inactiveDeductions: includeInactive ? inactive : [],
      totalActive: active.length,
      totalInactive: inactive.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/employees/[id]/deductions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateDeductionRequest {
  deductionTypeId: string;
  effectiveFrom: string;
  calcMethod: "fixed" | "percent_gross" | "percent_net";
  amount: string;
  perPeriodLimit?: string;
  annualLimit?: string;
  caseNumber?: string;
  garnishmentType?: string;
  garnishmentPriority?: number;
}

/**
 * POST /api/payroll/employees/[id]/deductions
 * Enroll employee in a deduction/benefit
 */
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id: employeeId } = await params;

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Verify employee exists and is active
    const [employee] = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        employmentStatus: employees.employmentStatus,
        personId: employees.personId,
      })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (employee.employmentStatus === "terminated") {
      return NextResponse.json(
        { error: "Cannot add deduction for terminated employee" },
        { status: 400 }
      );
    }

    const body: CreateDeductionRequest = await req.json();

    // Validate required fields
    if (!body.deductionTypeId) {
      return NextResponse.json({ error: "deductionTypeId is required" }, { status: 400 });
    }
    if (!body.effectiveFrom) {
      return NextResponse.json({ error: "effectiveFrom is required" }, { status: 400 });
    }
    if (!body.calcMethod) {
      return NextResponse.json({ error: "calcMethod is required" }, { status: 400 });
    }
    if (!body.amount) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }

    // Validate deduction type exists
    if (!isValidUuid(body.deductionTypeId)) {
      return NextResponse.json({ error: "Invalid deductionTypeId format" }, { status: 400 });
    }

    const [deductionType] = await db
      .select({
        id: deductionTypes.id,
        code: deductionTypes.code,
        name: deductionTypes.name,
        category: deductionTypes.category,
      })
      .from(deductionTypes)
      .where(eq(deductionTypes.id, body.deductionTypeId));

    if (!deductionType) {
      return NextResponse.json({ error: "Deduction type not found" }, { status: 404 });
    }

    // Check if employee already has active enrollment in this deduction type
    const [existingActive] = await db
      .select({ id: employeeDeductions.id })
      .from(employeeDeductions)
      .where(
        and(
          eq(employeeDeductions.tenantId, tenantId),
          eq(employeeDeductions.employeeId, employeeId),
          eq(employeeDeductions.deductionTypeId, body.deductionTypeId),
          eq(employeeDeductions.isActive, true)
        )
      );

    if (existingActive) {
      return NextResponse.json(
        {
          error: `Employee already has active enrollment in ${deductionType.name}`,
          existingDeductionId: existingActive.id,
        },
        { status: 409 }
      );
    }

    // Validate amount
    const amt = parseFloat(body.amount);
    if (isNaN(amt) || amt < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }

    // Create deduction enrollment
    const [newDeduction] = await db
      .insert(employeeDeductions)
      .values({
        tenantId,
        employeeId,
        deductionTypeId: body.deductionTypeId,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: null,
        calcMethod: body.calcMethod,
        amount: body.amount,
        perPeriodLimit: body.perPeriodLimit ?? null,
        annualLimit: body.annualLimit ?? null,
        ytdAmount: "0",
        caseNumber: body.caseNumber ?? null,
        garnishmentType: body.garnishmentType ?? null,
        garnishmentPriority: body.garnishmentPriority ?? null,
        isActive: true,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Get person name for audit
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, employee.personId));

    await audit.log("employee", employeeId, "employee_deduction_created", {
      deductionId: newDeduction.id,
      deductionTypeCode: deductionType.code,
      deductionTypeName: deductionType.name,
      category: deductionType.category,
      calcMethod: body.calcMethod,
      amount: body.amount,
      effectiveFrom: body.effectiveFrom,
      employeeNumber: employee.employeeNumber,
      personName: person?.fullName,
    });

    return NextResponse.json(
      {
        deductionId: newDeduction.id,
        deductionType: deductionType.name,
        effectiveFrom: body.effectiveFrom,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/employees/[id]/deductions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateDeductionRequest {
  deductionId: string;
  calcMethod?: "fixed" | "percent_gross" | "percent_net";
  amount?: string;
  perPeriodLimit?: string | null;
  annualLimit?: string | null;
  endDeduction?: boolean;
  endDate?: string;
}

/**
 * PATCH /api/payroll/employees/[id]/deductions
 * Update or end a deduction enrollment
 */
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id: employeeId } = await params;

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    const body: UpdateDeductionRequest = await req.json();

    if (!body.deductionId) {
      return NextResponse.json({ error: "deductionId is required" }, { status: 400 });
    }

    if (!isValidUuid(body.deductionId)) {
      return NextResponse.json({ error: "Invalid deductionId format" }, { status: 400 });
    }

    // Verify deduction exists and belongs to this employee
    const [deduction] = await db
      .select({
        id: employeeDeductions.id,
        isActive: employeeDeductions.isActive,
        deductionTypeId: employeeDeductions.deductionTypeId,
      })
      .from(employeeDeductions)
      .where(
        and(
          eq(employeeDeductions.tenantId, tenantId),
          eq(employeeDeductions.id, body.deductionId),
          eq(employeeDeductions.employeeId, employeeId)
        )
      );

    if (!deduction) {
      return NextResponse.json({ error: "Deduction not found for this employee" }, { status: 404 });
    }

    // Get deduction type name for audit
    const [deductionType] = await db
      .select({ code: deductionTypes.code, name: deductionTypes.name })
      .from(deductionTypes)
      .where(eq(deductionTypes.id, deduction.deductionTypeId));

    // End deduction if requested
    if (body.endDeduction) {
      if (!deduction.isActive) {
        return NextResponse.json({ error: "Deduction is already ended" }, { status: 400 });
      }

      const endDate = body.endDate || new Date().toISOString().split("T")[0];

      await db
        .update(employeeDeductions)
        .set({
          effectiveTo: endDate,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(employeeDeductions.id, body.deductionId));

      await audit.log("employee", employeeId, "employee_deduction_ended", {
        deductionId: body.deductionId,
        deductionTypeName: deductionType?.name,
        endDate,
      });

      return NextResponse.json({ success: true, message: "Deduction ended", endDate });
    }

    // Otherwise update the deduction
    if (!deduction.isActive) {
      return NextResponse.json({ error: "Cannot update ended deduction" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.calcMethod !== undefined) {
      updates.calcMethod = body.calcMethod;
    }
    if (body.amount !== undefined) {
      const amt = parseFloat(body.amount);
      if (isNaN(amt) || amt < 0) {
        return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
      }
      updates.amount = body.amount;
    }
    if (body.perPeriodLimit !== undefined) {
      updates.perPeriodLimit = body.perPeriodLimit;
    }
    if (body.annualLimit !== undefined) {
      updates.annualLimit = body.annualLimit;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    updates.updatedAt = new Date();

    await db
      .update(employeeDeductions)
      .set(updates)
      .where(eq(employeeDeductions.id, body.deductionId));

    await audit.log("employee", employeeId, "employee_deduction_updated", {
      deductionId: body.deductionId,
      deductionTypeName: deductionType?.name,
      updates: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/payroll/employees/[id]/deductions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
