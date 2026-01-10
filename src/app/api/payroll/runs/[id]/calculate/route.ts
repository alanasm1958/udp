/**
 * /api/payroll/runs/[id]/calculate
 *
 * Calculate payroll for all active employees in a pay period.
 * Creates/updates payroll_run_employees and detail records.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payrollRuns,
  payrollRunEmployees,
  payrollEarnings,
  payrollTaxes,
  payrollDeductions,
  payPeriods,
  employees,
  people,
  compensationRecords,
  employeeDeductions,
  deductionTypes,
  earningTypes,
} from "@/db/schema";
import { eq, and, desc, lte, sql, isNull, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import {
  calculateEmployeePayroll,
  calculatePayrollSummary,
  PayrollEmployee,
  PayrollCalculationResult,
} from "@/lib/payroll";

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/runs/[id]/calculate
 * Calculate payroll for all employees in the run
 */
export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid payroll run ID format" }, { status: 400 });
    }

    // Get the payroll run
    const [run] = await db
      .select({
        id: payrollRuns.id,
        status: payrollRuns.status,
        payPeriodId: payrollRuns.payPeriodId,
        periodStart: payPeriods.startDate,
        periodEnd: payPeriods.endDate,
        payDate: payPeriods.payDate,
      })
      .from(payrollRuns)
      .innerJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    // Check status - must be draft or calculated to recalculate
    if (!["draft", "calculated"].includes(run.status)) {
      return NextResponse.json(
        { error: `Cannot calculate payroll run in ${run.status} status. Only draft or calculated runs can be recalculated.` },
        { status: 400 }
      );
    }

    // Update status to calculating
    await db
      .update(payrollRuns)
      .set({ status: "calculating", updatedAt: sql`now()` })
      .where(eq(payrollRuns.id, id));

    try {
      // Get all active employees with their compensation
      const activeEmployees = await db
        .select({
          employeeId: employees.id,
          personId: people.id,
          fullName: people.fullName,
          employeeNumber: employees.employeeNumber,
          employmentStatus: employees.employmentStatus,
          federalFilingStatus: employees.federalFilingStatus,
          federalAllowances: employees.federalAllowances,
          additionalFederalWithholding: employees.additionalFederalWithholding,
          isExemptFromFederal: employees.isExemptFromFederal,
          isExemptFromState: employees.isExemptFromState,
          isExemptFromFica: employees.isExemptFromFica,
          w4Step2Checkbox: employees.w4Step2Checkbox,
          w4DependentsAmount: employees.w4DependentsAmount,
          w4OtherIncome: employees.w4OtherIncome,
          w4Deductions: employees.w4Deductions,
          paymentMethod: employees.paymentMethod,
        })
        .from(employees)
        .innerJoin(people, eq(employees.personId, people.id))
        .where(
          and(
            eq(employees.tenantId, tenantId),
            eq(employees.employmentStatus, "active")
          )
        );

      const results: PayrollCalculationResult[] = [];

      // Get default earning type for regular pay (earningTypes is a global table)
      const [regEarningType] = await db
        .select({ id: earningTypes.id })
        .from(earningTypes)
        .where(eq(earningTypes.code, "REG"));

      for (const emp of activeEmployees) {
        // Get current compensation
        const [compensation] = await db
          .select({
            payType: compensationRecords.payType,
            payRate: compensationRecords.payRate,
            payFrequency: compensationRecords.payFrequency,
            standardHoursPerWeek: compensationRecords.standardHoursPerWeek,
          })
          .from(compensationRecords)
          .where(
            and(
              eq(compensationRecords.tenantId, tenantId),
              eq(compensationRecords.employeeId, emp.employeeId),
              lte(compensationRecords.effectiveFrom, run.periodEnd),
              or(
                isNull(compensationRecords.effectiveTo),
                sql`${compensationRecords.effectiveTo} >= ${run.periodStart}`
              )
            )
          )
          .orderBy(desc(compensationRecords.effectiveFrom))
          .limit(1);

        if (!compensation) {
          // Skip employees without compensation records
          continue;
        }

        // Get employee deductions
        const empDeductions = await db
          .select({
            id: employeeDeductions.id,
            deductionTypeId: employeeDeductions.deductionTypeId,
            deductionTypeName: deductionTypes.name,
            deductionTypeCode: deductionTypes.code,
            calcMethod: employeeDeductions.calcMethod,
            amount: employeeDeductions.amount,
            annualLimit: employeeDeductions.annualLimit,
            ytdAmount: employeeDeductions.ytdAmount,
          })
          .from(employeeDeductions)
          .innerJoin(deductionTypes, eq(employeeDeductions.deductionTypeId, deductionTypes.id))
          .where(
            and(
              eq(employeeDeductions.tenantId, tenantId),
              eq(employeeDeductions.employeeId, emp.employeeId),
              eq(employeeDeductions.isActive, true)
            )
          );

        // Build PayrollEmployee object
        const payrollEmployee: PayrollEmployee = {
          employeeId: emp.employeeId,
          personId: emp.personId,
          fullName: emp.fullName,
          employeeNumber: emp.employeeNumber,
          payType: compensation.payType as "salary" | "hourly" | "commission",
          payRate: parseFloat(compensation.payRate),
          payFrequency: compensation.payFrequency as "weekly" | "biweekly" | "semimonthly" | "monthly",
          standardHoursPerWeek: parseFloat(compensation.standardHoursPerWeek || "40"),
          federalFilingStatus: emp.federalFilingStatus || "single",
          federalAllowances: emp.federalAllowances || 0,
          additionalFederalWithholding: parseFloat(emp.additionalFederalWithholding || "0"),
          isExemptFromFederal: emp.isExemptFromFederal || false,
          isExemptFromState: emp.isExemptFromState || false,
          isExemptFromFica: emp.isExemptFromFica || false,
          w4Step2Checkbox: emp.w4Step2Checkbox || false,
          w4DependentsAmount: parseFloat(emp.w4DependentsAmount || "0"),
          w4OtherIncome: parseFloat(emp.w4OtherIncome || "0"),
          w4Deductions: parseFloat(emp.w4Deductions || "0"),
          ytdGross: 0, // TODO: Get from previous payroll runs
          ytdFederalTax: 0,
          ytdStateTax: 0,
          ytdSocialSecurity: 0,
          ytdMedicare: 0,
          deductions: empDeductions.map((d) => ({
            id: d.id,
            deductionTypeId: d.deductionTypeId,
            deductionTypeName: d.deductionTypeName || "",
            deductionTypeCode: d.deductionTypeCode || "",
            calculationMethod: (d.calcMethod as "flat" | "percent_gross" | "percent_net" | "hours") || "flat",
            amount: parseFloat(d.amount || "0"),
            maxAnnualLimit: d.annualLimit ? parseFloat(d.annualLimit) : null,
            ytdAmount: parseFloat(d.ytdAmount || "0"),
            hasEmployerMatch: false, // Simplified - employer match not yet supported in schema
            employerMatchPercent: null,
            employerMatchMaxPercent: null,
          })),
          paymentMethod: emp.paymentMethod || "check",
        };

        // Calculate payroll
        const result = calculateEmployeePayroll(payrollEmployee, run.periodStart, run.periodEnd);
        results.push(result);
      }

      // Delete existing payroll run employees (cascade deletes earnings/taxes/deductions)
      await db
        .delete(payrollRunEmployees)
        .where(eq(payrollRunEmployees.payrollRunId, id));

      // Insert new payroll run employees
      for (const result of results) {
        const [runEmployee] = await db
          .insert(payrollRunEmployees)
          .values({
            tenantId,
            payrollRunId: id,
            employeeId: result.employeeId,
            payType: result.payType,
            payRate: result.payRate.toFixed(4),
            grossPay: result.grossPay.toFixed(2),
            totalTaxes: result.totalTaxes.toFixed(2),
            totalDeductions: result.totalDeductions.toFixed(2),
            netPay: result.netPay.toFixed(2),
            employerTaxes: result.employerTaxes.toFixed(2),
            employerContributions: result.employerContributions.toFixed(2),
            totalEmployerCost: result.totalEmployerCost.toFixed(2),
            ytdGross: result.ytdGross.toFixed(2),
            paymentMethod: result.paymentMethod,
            status: "pending",
          })
          .returning({ id: payrollRunEmployees.id });

        // Insert earnings
        for (const earning of result.earnings) {
          await db.insert(payrollEarnings).values({
            tenantId,
            payrollRunEmployeeId: runEmployee.id,
            earningTypeId: regEarningType?.id || earning.earningTypeId,
            hours: earning.hours?.toFixed(2) ?? null,
            rate: earning.rate?.toFixed(4) ?? null,
            amount: earning.amount.toFixed(2),
            description: earning.description,
          });
        }

        // Insert taxes
        for (const tax of result.taxes) {
          await db.insert(payrollTaxes).values({
            tenantId,
            payrollRunEmployeeId: runEmployee.id,
            taxType: tax.taxType,
            taxableWages: tax.taxableWages.toFixed(2),
            taxRate: tax.taxRate?.toFixed(6) ?? null,
            employeeAmount: tax.employeeAmount.toFixed(2),
            employerAmount: tax.employerAmount.toFixed(2),
            calculationDetails: tax.calculationDetails,
          });
        }

        // Insert deductions
        for (const deduction of result.deductions) {
          await db.insert(payrollDeductions).values({
            tenantId,
            payrollRunEmployeeId: runEmployee.id,
            deductionTypeId: deduction.deductionTypeId,
            employeeAmount: deduction.employeeAmount.toFixed(2),
            employerAmount: deduction.employerAmount.toFixed(2),
            ytdEmployeeAmount: deduction.ytdEmployeeAmount.toFixed(2),
            ytdEmployerAmount: deduction.ytdEmployerAmount.toFixed(2),
            calculationDetails: deduction.calculationDetails,
          });
        }
      }

      // Calculate summary
      const summary = calculatePayrollSummary(results);

      // Update payroll run with totals
      await db
        .update(payrollRuns)
        .set({
          status: "calculated",
          totalGrossPay: summary.totalGrossPay.toFixed(2),
          totalEmployeeTaxes: summary.totalEmployeeTaxes.toFixed(2),
          totalEmployeeDeductions: summary.totalEmployeeDeductions.toFixed(2),
          totalNetPay: summary.totalNetPay.toFixed(2),
          totalEmployerTaxes: summary.totalEmployerTaxes.toFixed(2),
          totalEmployerContributions: summary.totalEmployerContributions.toFixed(2),
          employeeCount: summary.employeeCount,
          calculatedAt: sql`now()`,
          calculatedByActorId: actor.actorId,
          updatedAt: sql`now()`,
        })
        .where(eq(payrollRuns.id, id));

      await audit.log("payroll_run", id, "payroll_calculated", {
        employeeCount: summary.employeeCount,
        totalGrossPay: summary.totalGrossPay,
        totalNetPay: summary.totalNetPay,
        anomalyCount: summary.anomalyCount,
      });

      return NextResponse.json({
        success: true,
        summary,
        anomalies: results.flatMap((r) =>
          r.anomalies.map((a) => ({ ...a, employeeId: r.employeeId, fullName: r.fullName }))
        ),
      });
    } catch (calcError) {
      // Revert status on error
      await db
        .update(payrollRuns)
        .set({ status: run.status === "calculated" ? "calculated" : "draft", updatedAt: sql`now()` })
        .where(eq(payrollRuns.id, id));

      throw calcError;
    }
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/runs/[id]/calculate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
