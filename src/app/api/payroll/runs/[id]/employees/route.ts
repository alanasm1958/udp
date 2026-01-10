/**
 * /api/payroll/runs/[id]/employees
 *
 * Get employees for a payroll run with their calculated earnings, taxes, and deductions.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payrollRuns,
  payrollRunEmployees,
  payrollEarnings,
  payrollTaxes,
  payrollDeductions,
  employees,
  people,
  earningTypes,
  deductionTypes,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/payroll/runs/[id]/employees
 * Get all employees in a payroll run with their line items
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid payroll run ID format" }, { status: 400 });
    }

    // Verify run exists and belongs to tenant
    const [run] = await db
      .select({ id: payrollRuns.id, status: payrollRuns.status })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    // Get employees with person info
    const runEmployees = await db
      .select({
        id: payrollRunEmployees.id,
        employeeId: payrollRunEmployees.employeeId,
        payType: payrollRunEmployees.payType,
        payRate: payrollRunEmployees.payRate,
        grossPay: payrollRunEmployees.grossPay,
        totalTaxes: payrollRunEmployees.totalTaxes,
        totalDeductions: payrollRunEmployees.totalDeductions,
        netPay: payrollRunEmployees.netPay,
        employerTaxes: payrollRunEmployees.employerTaxes,
        employerContributions: payrollRunEmployees.employerContributions,
        totalEmployerCost: payrollRunEmployees.totalEmployerCost,
        ytdGross: payrollRunEmployees.ytdGross,
        paymentMethod: payrollRunEmployees.paymentMethod,
        status: payrollRunEmployees.status,
        // Employee info
        employeeNumber: employees.employeeNumber,
        // Person info
        personId: people.id,
        fullName: people.fullName,
        email: people.primaryEmail,
      })
      .from(payrollRunEmployees)
      .innerJoin(employees, eq(payrollRunEmployees.employeeId, employees.id))
      .innerJoin(people, eq(employees.personId, people.id))
      .where(eq(payrollRunEmployees.payrollRunId, id))
      .orderBy(asc(people.fullName));

    // For each employee, get their earnings, taxes, and deductions
    const employeesWithDetails = await Promise.all(
      runEmployees.map(async (emp) => {
        // Get earnings
        const earnings = await db
          .select({
            id: payrollEarnings.id,
            earningTypeId: payrollEarnings.earningTypeId,
            hours: payrollEarnings.hours,
            rate: payrollEarnings.rate,
            amount: payrollEarnings.amount,
            description: payrollEarnings.description,
            earningTypeName: earningTypes.name,
            earningTypeCode: earningTypes.code,
          })
          .from(payrollEarnings)
          .leftJoin(earningTypes, eq(payrollEarnings.earningTypeId, earningTypes.id))
          .where(eq(payrollEarnings.payrollRunEmployeeId, emp.id));

        // Get taxes
        const taxes = await db
          .select({
            id: payrollTaxes.id,
            taxType: payrollTaxes.taxType,
            taxableWages: payrollTaxes.taxableWages,
            taxRate: payrollTaxes.taxRate,
            employeeAmount: payrollTaxes.employeeAmount,
            employerAmount: payrollTaxes.employerAmount,
            calculationDetails: payrollTaxes.calculationDetails,
          })
          .from(payrollTaxes)
          .where(eq(payrollTaxes.payrollRunEmployeeId, emp.id));

        // Get deductions
        const deductions = await db
          .select({
            id: payrollDeductions.id,
            deductionTypeId: payrollDeductions.deductionTypeId,
            employeeAmount: payrollDeductions.employeeAmount,
            employerAmount: payrollDeductions.employerAmount,
            deductionTypeName: deductionTypes.name,
            deductionTypeCode: deductionTypes.code,
          })
          .from(payrollDeductions)
          .leftJoin(deductionTypes, eq(payrollDeductions.deductionTypeId, deductionTypes.id))
          .where(eq(payrollDeductions.payrollRunEmployeeId, emp.id));

        return {
          ...emp,
          earnings,
          taxes,
          deductions,
        };
      })
    );

    return NextResponse.json({ employees: employeesWithDetails });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/runs/[id]/employees error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
