/**
 * /api/payroll/employees
 *
 * CRUD endpoints for payroll employees.
 * Employees are linked to people records and contain payroll-specific data
 * like tax withholding, FLSA status, pay type, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  employees,
  people,
  jurisdictions,
  compensationRecords,
} from "@/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateEmployeeRequest {
  personId: string;
  employeeNumber?: string;
  hireDate: string;
  employmentType: "full_time" | "part_time" | "contractor" | "temp" | "intern";
  flsaStatus?: "exempt" | "non_exempt";
  workerCompClass?: string;
  workJurisdictionId?: string;
  workLocation?: string;
  isRemote?: boolean;
  managerEmployeeId?: string;
  // Tax info
  federalFilingStatus?: string;
  stateFilingStatus?: string;
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
  // Initial compensation (optional - can be added separately)
  initialCompensation?: {
    payType: "salary" | "hourly" | "commission";
    payRate: string;
    payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
    commissionRate?: string;
    commissionBasis?: string;
    standardHoursPerWeek?: string;
  };
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function generateEmployeeNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `EMP-${timestamp}${random}`;
}

/**
 * GET /api/payroll/employees
 * List employees with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const typeFilter = url.searchParams.get("type");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(employees.tenantId, tenantId)];

    if (statusFilter) {
      conditions.push(eq(employees.employmentStatus, statusFilter as "active" | "on_leave" | "suspended" | "terminated" | "retired"));
    } else {
      // Default to active employees
      conditions.push(eq(employees.employmentStatus, "active"));
    }

    if (typeFilter) {
      conditions.push(eq(employees.employmentType, typeFilter as "full_time" | "part_time" | "contractor" | "temp" | "intern"));
    }

    // Join with people for search
    const employeesList = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
        employmentStatus: employees.employmentStatus,
        employmentType: employees.employmentType,
        flsaStatus: employees.flsaStatus,
        workLocation: employees.workLocation,
        isRemote: employees.isRemote,
        paymentMethod: employees.paymentMethod,
        createdAt: employees.createdAt,
        // Person info
        personId: employees.personId,
        personFullName: people.fullName,
        personEmail: people.primaryEmail,
        personPhone: people.primaryPhone,
      })
      .from(employees)
      .innerJoin(people, eq(employees.personId, people.id))
      .where(
        searchQuery
          ? and(
              ...conditions,
              or(
                ilike(people.fullName, `%${searchQuery}%`),
                ilike(employees.employeeNumber, `%${searchQuery}%`),
                ilike(people.primaryEmail, `%${searchQuery}%`)
              )
            )
          : and(...conditions)
      )
      .orderBy(people.fullName)
      .limit(limit);

    return NextResponse.json({ employees: employeesList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/employees error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payroll/employees
 * Create a new employee record
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateEmployeeRequest = await req.json();

    // Validate required fields
    if (!body.personId) {
      return NextResponse.json({ error: "personId is required" }, { status: 400 });
    }
    if (!body.hireDate) {
      return NextResponse.json({ error: "hireDate is required" }, { status: 400 });
    }
    if (!body.employmentType) {
      return NextResponse.json({ error: "employmentType is required" }, { status: 400 });
    }

    // Validate personId
    if (!isValidUuid(body.personId)) {
      return NextResponse.json({ error: "Invalid personId format" }, { status: 400 });
    }
    const [person] = await db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(and(eq(people.tenantId, tenantId), eq(people.id, body.personId)));
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Check if employee already exists for this person
    const [existingEmployee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.personId, body.personId)));
    if (existingEmployee) {
      return NextResponse.json(
        { error: "Employee record already exists for this person", existingEmployeeId: existingEmployee.id },
        { status: 409 }
      );
    }

    // Validate work jurisdiction if provided
    if (body.workJurisdictionId) {
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
    }

    // Validate manager if provided
    if (body.managerEmployeeId) {
      if (!isValidUuid(body.managerEmployeeId)) {
        return NextResponse.json({ error: "Invalid managerEmployeeId format" }, { status: 400 });
      }
      const [manager] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.id, body.managerEmployeeId)));
      if (!manager) {
        return NextResponse.json({ error: "Manager employee not found" }, { status: 404 });
      }
    }

    // Generate employee number if not provided
    const employeeNumber = body.employeeNumber || generateEmployeeNumber();

    // Create employee
    const [employee] = await db
      .insert(employees)
      .values({
        tenantId,
        personId: body.personId,
        employeeNumber,
        hireDate: body.hireDate,
        employmentStatus: "active",
        employmentType: body.employmentType,
        flsaStatus: body.flsaStatus ?? "non_exempt",
        workerCompClass: body.workerCompClass ?? null,
        workJurisdictionId: body.workJurisdictionId ?? null,
        workLocation: body.workLocation ?? null,
        isRemote: body.isRemote ?? false,
        managerEmployeeId: body.managerEmployeeId ?? null,
        // Tax info
        federalFilingStatus: body.federalFilingStatus ?? "single",
        stateFilingStatus: body.stateFilingStatus ?? null,
        federalAllowances: body.federalAllowances ?? 0,
        stateAllowances: body.stateAllowances ?? 0,
        additionalFederalWithholding: body.additionalFederalWithholding ?? "0",
        additionalStateWithholding: body.additionalStateWithholding ?? "0",
        isExemptFromFederal: body.isExemptFromFederal ?? false,
        isExemptFromState: body.isExemptFromState ?? false,
        isExemptFromFica: body.isExemptFromFica ?? false,
        // W-4 2020+ fields
        w4Step2Checkbox: body.w4Step2Checkbox ?? false,
        w4DependentsAmount: body.w4DependentsAmount ?? "0",
        w4OtherIncome: body.w4OtherIncome ?? "0",
        w4Deductions: body.w4Deductions ?? "0",
        // Payment
        paymentMethod: body.paymentMethod ?? "check",
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("employee", employee.id, "employee_created", {
      personId: body.personId,
      personName: person.fullName,
      employeeNumber,
      hireDate: body.hireDate,
      employmentType: body.employmentType,
    });

    // Create initial compensation record if provided
    if (body.initialCompensation) {
      const comp = body.initialCompensation;
      await db.insert(compensationRecords).values({
        tenantId,
        employeeId: employee.id,
        effectiveFrom: body.hireDate,
        payType: comp.payType,
        payRate: comp.payRate,
        payFrequency: comp.payFrequency,
        commissionRate: comp.commissionRate ?? null,
        commissionBasis: comp.commissionBasis ?? null,
        standardHoursPerWeek: comp.standardHoursPerWeek ?? "40.00",
        changeReason: "hire",
        changeNotes: "Initial hire compensation",
        createdByActorId: actor.actorId,
      });

      await audit.log("employee", employee.id, "compensation_created", {
        payType: comp.payType,
        payRate: comp.payRate,
        payFrequency: comp.payFrequency,
        reason: "hire",
      });
    }

    return NextResponse.json({ employeeId: employee.id, employeeNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/employees error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
