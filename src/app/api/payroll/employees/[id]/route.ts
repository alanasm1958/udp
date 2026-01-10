/**
 * /api/payroll/employees/[id]
 *
 * Single employee CRUD operations: GET details, PATCH update, POST terminate
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  employees,
  people,
  jurisdictions,
  compensationRecords,
} from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
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
 * GET /api/payroll/employees/[id]
 * Get detailed employee information including current compensation
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Get employee with person info
    const [employee] = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
        employmentStatus: employees.employmentStatus,
        employmentType: employees.employmentType,
        flsaStatus: employees.flsaStatus,
        workerCompClass: employees.workerCompClass,
        workLocation: employees.workLocation,
        isRemote: employees.isRemote,
        paymentMethod: employees.paymentMethod,
        // Tax info
        federalFilingStatus: employees.federalFilingStatus,
        stateFilingStatus: employees.stateFilingStatus,
        federalAllowances: employees.federalAllowances,
        stateAllowances: employees.stateAllowances,
        additionalFederalWithholding: employees.additionalFederalWithholding,
        additionalStateWithholding: employees.additionalStateWithholding,
        isExemptFromFederal: employees.isExemptFromFederal,
        isExemptFromState: employees.isExemptFromState,
        isExemptFromFica: employees.isExemptFromFica,
        // W-4 2020+ fields
        w4Step2Checkbox: employees.w4Step2Checkbox,
        w4DependentsAmount: employees.w4DependentsAmount,
        w4OtherIncome: employees.w4OtherIncome,
        w4Deductions: employees.w4Deductions,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
        // Person info
        personId: employees.personId,
        personFullName: people.fullName,
        personEmail: people.primaryEmail,
        personPhone: people.primaryPhone,
        // Work jurisdiction
        workJurisdictionId: employees.workJurisdictionId,
        // Manager
        managerEmployeeId: employees.managerEmployeeId,
      })
      .from(employees)
      .innerJoin(people, eq(employees.personId, people.id))
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, id)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Get work jurisdiction name if present
    let workJurisdiction = null;
    if (employee.workJurisdictionId) {
      const [j] = await db
        .select({ id: jurisdictions.id, name: jurisdictions.name, code: jurisdictions.code })
        .from(jurisdictions)
        .where(eq(jurisdictions.id, employee.workJurisdictionId));
      workJurisdiction = j || null;
    }

    // Get current compensation (most recent effective)
    const [currentCompensation] = await db
      .select({
        id: compensationRecords.id,
        effectiveFrom: compensationRecords.effectiveFrom,
        effectiveTo: compensationRecords.effectiveTo,
        payType: compensationRecords.payType,
        payRate: compensationRecords.payRate,
        payFrequency: compensationRecords.payFrequency,
        commissionRate: compensationRecords.commissionRate,
        commissionBasis: compensationRecords.commissionBasis,
        standardHoursPerWeek: compensationRecords.standardHoursPerWeek,
      })
      .from(compensationRecords)
      .where(
        and(
          eq(compensationRecords.tenantId, tenantId),
          eq(compensationRecords.employeeId, id),
          isNull(compensationRecords.effectiveTo)
        )
      )
      .orderBy(desc(compensationRecords.effectiveFrom))
      .limit(1);

    // Get manager info if exists
    let manager = null;
    if (employee.managerEmployeeId) {
      const [managerData] = await db
        .select({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
          personFullName: people.fullName,
        })
        .from(employees)
        .innerJoin(people, eq(employees.personId, people.id))
        .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employee.managerEmployeeId)));
      manager = managerData || null;
    }

    return NextResponse.json({
      employee: {
        ...employee,
        workJurisdiction,
        manager,
        currentCompensation: currentCompensation || null,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/employees/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateEmployeeRequest {
  employmentType?: "full_time" | "part_time" | "contractor" | "temp" | "intern";
  flsaStatus?: "exempt" | "non_exempt";
  workerCompClass?: string;
  workJurisdictionId?: string | null;
  workLocation?: string | null;
  isRemote?: boolean;
  managerEmployeeId?: string | null;
  // Tax info
  federalFilingStatus?: string;
  stateFilingStatus?: string | null;
  federalAllowances?: number;
  stateAllowances?: number;
  additionalFederalWithholding?: string;
  additionalStateWithholding?: string;
  isExemptFromFederal?: boolean;
  isExemptFromState?: boolean;
  isExemptFromFica?: boolean;
  // W-4 2020+ fields
  w4Step2Checkbox?: boolean;
  w4DependentsAmount?: string;
  w4OtherIncome?: string;
  w4Deductions?: string;
  // Payment
  paymentMethod?: string;
}

/**
 * PATCH /api/payroll/employees/[id]
 * Update employee details (not compensation - use /compensation endpoint)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Check employee exists
    const [existing] = await db
      .select({ id: employees.id, employmentStatus: employees.employmentStatus })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (existing.employmentStatus === "terminated") {
      return NextResponse.json(
        { error: "Cannot update terminated employee" },
        { status: 400 }
      );
    }

    const body: UpdateEmployeeRequest = await req.json();
    const updates: Record<string, unknown> = {};

    // Validate and collect updates
    if (body.employmentType !== undefined) {
      updates.employmentType = body.employmentType;
    }
    if (body.flsaStatus !== undefined) {
      updates.flsaStatus = body.flsaStatus;
    }
    if (body.workerCompClass !== undefined) {
      updates.workerCompClass = body.workerCompClass || null;
    }
    if (body.workLocation !== undefined) {
      updates.workLocation = body.workLocation;
    }
    if (body.isRemote !== undefined) {
      updates.isRemote = body.isRemote;
    }
    if (body.paymentMethod !== undefined) {
      updates.paymentMethod = body.paymentMethod;
    }

    // Validate work jurisdiction if provided
    if (body.workJurisdictionId !== undefined) {
      if (body.workJurisdictionId === null) {
        updates.workJurisdictionId = null;
      } else {
        if (!isValidUuid(body.workJurisdictionId)) {
          return NextResponse.json({ error: "Invalid workJurisdictionId format" }, { status: 400 });
        }
        const [jurisdiction] = await db
          .select({ id: jurisdictions.id })
          .from(jurisdictions)
          .where(eq(jurisdictions.id, body.workJurisdictionId));
        if (!jurisdiction) {
          return NextResponse.json({ error: "Work jurisdiction not found" }, { status: 404 });
        }
        updates.workJurisdictionId = body.workJurisdictionId;
      }
    }

    // Validate manager if provided
    if (body.managerEmployeeId !== undefined) {
      if (body.managerEmployeeId === null) {
        updates.managerEmployeeId = null;
      } else {
        if (!isValidUuid(body.managerEmployeeId)) {
          return NextResponse.json({ error: "Invalid managerEmployeeId format" }, { status: 400 });
        }
        if (body.managerEmployeeId === id) {
          return NextResponse.json({ error: "Employee cannot be their own manager" }, { status: 400 });
        }
        const [manager] = await db
          .select({ id: employees.id })
          .from(employees)
          .where(and(eq(employees.tenantId, tenantId), eq(employees.id, body.managerEmployeeId)));
        if (!manager) {
          return NextResponse.json({ error: "Manager employee not found" }, { status: 404 });
        }
        updates.managerEmployeeId = body.managerEmployeeId;
      }
    }

    // Tax info updates
    if (body.federalFilingStatus !== undefined) updates.federalFilingStatus = body.federalFilingStatus;
    if (body.stateFilingStatus !== undefined) updates.stateFilingStatus = body.stateFilingStatus;
    if (body.federalAllowances !== undefined) updates.federalAllowances = body.federalAllowances;
    if (body.stateAllowances !== undefined) updates.stateAllowances = body.stateAllowances;
    if (body.additionalFederalWithholding !== undefined) updates.additionalFederalWithholding = body.additionalFederalWithholding;
    if (body.additionalStateWithholding !== undefined) updates.additionalStateWithholding = body.additionalStateWithholding;
    if (body.isExemptFromFederal !== undefined) updates.isExemptFromFederal = body.isExemptFromFederal;
    if (body.isExemptFromState !== undefined) updates.isExemptFromState = body.isExemptFromState;
    if (body.isExemptFromFica !== undefined) updates.isExemptFromFica = body.isExemptFromFica;

    // W-4 2020+ updates
    if (body.w4Step2Checkbox !== undefined) updates.w4Step2Checkbox = body.w4Step2Checkbox;
    if (body.w4DependentsAmount !== undefined) updates.w4DependentsAmount = body.w4DependentsAmount;
    if (body.w4OtherIncome !== undefined) updates.w4OtherIncome = body.w4OtherIncome;
    if (body.w4Deductions !== undefined) updates.w4Deductions = body.w4Deductions;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    updates.updatedAt = new Date();

    await db.update(employees).set(updates).where(eq(employees.id, id));

    await audit.log("employee", id, "employee_updated", { updates: Object.keys(updates) });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/payroll/employees/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface TerminateEmployeeRequest {
  terminationDate: string;
}

/**
 * POST /api/payroll/employees/[id]?action=terminate
 * Terminate an employee (soft delete - keeps record)
 */
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    // Check if this is a termination request
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action !== "terminate") {
      return NextResponse.json({ error: "Invalid action. Use ?action=terminate" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Check employee exists and is active
    const [existing] = await db
      .select({
        id: employees.id,
        employmentStatus: employees.employmentStatus,
        employeeNumber: employees.employeeNumber,
      })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (existing.employmentStatus === "terminated") {
      return NextResponse.json({ error: "Employee is already terminated" }, { status: 400 });
    }

    const body: TerminateEmployeeRequest = await req.json();

    if (!body.terminationDate) {
      return NextResponse.json({ error: "terminationDate is required" }, { status: 400 });
    }

    // Update employee status
    await db
      .update(employees)
      .set({
        employmentStatus: "terminated",
        terminationDate: body.terminationDate,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id));

    // End current compensation record
    await db
      .update(compensationRecords)
      .set({
        effectiveTo: body.terminationDate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(compensationRecords.employeeId, id),
          isNull(compensationRecords.effectiveTo)
        )
      );

    await audit.log("employee", id, "employee_terminated", {
      terminationDate: body.terminationDate,
    });

    return NextResponse.json({ success: true, message: "Employee terminated successfully" });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/employees/[id] terminate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
